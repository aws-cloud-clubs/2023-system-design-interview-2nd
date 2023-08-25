Message Queue
=============

# Message Queue 개념
- Message Queue는 MOM을 구현한 시스템
  - MOM(Message Oriented Middleware)는 '비동기 메시지를 사용하는 다른 응용 프로그램 사이에서 데이터 송수신'을 의미
- JMS(Java Messaging Service) : Java로 구현된 시스템끼리 MOM을 구현하기 위한 서비스. Java로 구현된 시스템끼리만 메시지 송수신이 가능하여 한계가 있음. JMS를 구현한 서비스: Amazon ActiveMQ, IBM MQ
  - 메시지 교환 모델로 P2P 모델과 pub/sub 모델 두개만 존재한다.
- AMQP(Advanced Message Queuing Protocol) : MOM 구현을 위한 표준 프로토콜. AMQP를 구현한 서비스: RabbitMQ
  - JMS보다 많은 메시지 교환 모델이 있음(https://velog.io/@vpdls1511/AMQPRabbitMqActiveMQKafka#activemq)
- Kafka는 위의 AMQP, JMS를 사용하지 않고, 단순한 메세지 헤더를 지닌 TCP 기반의 프로토콜을 사용해 오버헤드가 비교적 작음. 또한 RabbitMQ는 mq가 push하여 consumer에게 메시지를 전달하지만, kafka는 consumer가 pull하여 메시지를 전달받는다.


# RabbitMQ에 대해 자세히 알아보자
![image](https://github.com/junchanpp/2023-system-design-interview-2nd/assets/49396352/02d49e43-5f17-4d33-89d2-db53d9fdfc0e)

- RabbitMQ는 AMQP를 구현한 오픈소스 메세지 브로커.
### AMQP 동작 방식
- Producers -> Broker(Exchange --> Binding --> Queue) -> Consumers 로 메시지가 전달됨.
- 즉, 메시지를 발행하는 Producer 에서 브로커의 Exchange 로 메시지를 전달하면, Binding 이라는 규칙에 의해 연결된 Queue로 메시지가 복사. 그 후, Comsumer에서 브로커의 Queue를 통해 메시지를 전달받음.
- 모든 메시지는 queue로 바로 전달되지 않고, 브로커의 Exchange에서 먼저 받음. Exchange의 종류는 Direct Exchange, Fanout Exchange, Topic Exchange, Headers Exchange가 있음.
  - Direct Exchange   
    Message의 Routing Key와 정확히 일치하는 Binding된 Queue로 Routing. 즉, 1:1 매칭으로 매칭된다.
  - Fanout Exchange   
    Binding된 모든 Queue에 Message를 Routing. 즉, 모든 queue에 broadcast한다. 이때, Routing Key는 무시된다.
  - Topic Exchange   
    특정 Routing Pattern이 일치하는 Queue로 Routing. Routing Key의 패턴(ex. "ca*")을 이용해서 라우팅
  - Header Exchange   
    key-value로 정의된 Header 속성을 통한 Routing. 이때는 Routing Key는 무시하고 헤더값을 본다.

  
# Spring boot에 RabbitMQ 연동하기

0. 도커로 rabbitMQ 실행하기   
  ```
  docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 --restart=unless-stopped rabbitmq:management
```
1. 의존성 추가   
  ```
https://mvnrepository.com/artifact/org.springframework.boot/spring-boot-starter-amqp/3.1.2
```       
2. RabbitMQConfig.java 추가
  ```
  package com.example.toy_project.config;
  
  
  import org.springframework.amqp.core.Binding;
  import org.springframework.amqp.core.BindingBuilder;
  import org.springframework.amqp.core.DirectExchange;
  import org.springframework.amqp.core.Queue;
  import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
  import org.springframework.amqp.rabbit.connection.ConnectionFactory;
  import org.springframework.amqp.rabbit.core.RabbitTemplate;
  import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
  import org.springframework.amqp.support.converter.MessageConverter;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  
  @Configuration
  public class RabbitMQConfig {
  
    @Value("${spring.rabbitmq.host}")
    private String rabbitmqHost;
  
    @Value("${spring.rabbitmq.port}")
    private int rabbitmqPort;
  
    @Value("${spring.rabbitmq.username}")
    private String rabbitmqUsername;
  
    @Value("${spring.rabbitmq.password}")
    private String rabbitmqPassword;
  
    @Value("${rabbitmq.queue.name}")
    private String queueName;
  
    @Value("${rabbitmq.exchange.name}")
    private String exchangeName;
  
    @Value("${rabbitmq.routing.key}")
    private String routingKey;
  
    @Bean
    public Queue queue() {
      return new Queue(queueName);
    }
  
    @Bean
    public DirectExchange exchange() {
      return new DirectExchange(exchangeName);
    }
  
    //사용할 큐 이름과 라우팅 키를 바인딩
    @Bean
    public Binding binding(Queue queue, DirectExchange exchange) {
      return BindingBuilder.bind(queue).to(exchange).with(routingKey);
    }
  
    //rabbitmq 연결
    @Bean
    public ConnectionFactory connectionFactory() {
      CachingConnectionFactory connectionFactory = new CachingConnectionFactory();
      connectionFactory.setHost(rabbitmqHost);
      connectionFactory.setPort(rabbitmqPort);
      connectionFactory.setUsername(rabbitmqUsername);
      connectionFactory.setPassword(rabbitmqPassword);
      return connectionFactory;
    }
    
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
      RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
      rabbitTemplate.setMessageConverter(Jackson2JsonMessageConverter());
      return rabbitTemplate;
    }
  
    @Bean
    public MessageConverter Jackson2JsonMessageConverter() {
      return new Jackson2JsonMessageConverter();
    }
  }

```
3.SendMethod 추가
  ```
  package com.example.toy_project.service;
  
  
  import lombok.RequiredArgsConstructor;
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.amqp.rabbit.core.RabbitTemplate;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.stereotype.Service;
  
  @Slf4j
  @RequiredArgsConstructor
  @Service
  public class SendMessageService {
  
    @Value("${rabbitmq.exchange.name}")
    private String exchangeName;
  
    @Value("${rabbitmq.routing.key}")
    private String routingKey;
  
    private final RabbitTemplate rabbitTemplate;
  
    public void sendMessage(String message) {
      log.info("message sent: {}", message);
      rabbitTemplate.convertAndSend(exchangeName, routingKey, message);
    }
  }
  ```
4. mesageListener 추가
  ```
  package com.example.toy_project.service;
  
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.amqp.rabbit.annotation.RabbitListener;
  import org.springframework.stereotype.Component;
  
  @Slf4j
  @Component
  public class MessageListener {
  
    @RabbitListener(queues = "${rabbitmq.queue.name}")
    public void receiveMessage(String message) {
      log.info("message received: {}", message);
    }
  }

```
### 결과

![image](https://github.com/junchanpp/2023-system-design-interview-2nd/assets/49396352/505fe337-b364-48c7-a8db-ba65be6590b6)

### TODO
- observer 패턴을 통해 메시지 분기 처리
------
# 참고
https://medium.com/@lamhotjm/jms-vs-amqp-7129bb878886
https://augustines.tistory.com/183
https://velog.io/@vpdls1511/AMQPRabbitMqActiveMQKafka#activemq
https://jonnung.dev/rabbitmq/2019/02/06/about-amqp-implementtation-of-rabbitmq/#gsc.tab=0
https://pamyferret.tistory.com/39
https://tychejin.tistory.com/420
