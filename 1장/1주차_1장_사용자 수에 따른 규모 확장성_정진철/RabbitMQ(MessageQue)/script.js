import amqp from "amqplib";

const MQ_URL = 'amqp://guest:guest@localhost:5672';

const script = async ()=> {
    console.log('세팅 시작')

    // 서버와 연결해주자.
    const connection = await amqp.connect(MQ_URL)
  
    // 채널을 만들고
    const channel = await connection.createChannel()
  
    // 1. Exchange를 만들자.
    await channel.assertExchange('Test', 'direct', { durable: true });

    // 2. Queue를 만들고
    await channel.assertQueue('TestQue', { durable: true });

    // 3. 만들어진 Queue에 대해서 Exchange에서 바인딩 해주자.
    //                       Exchange,     Queue,    Routing Key
    await channel.bindQueue('TestQue', 'Test', 'systemDesignStudy');
  
    console.log('설정 끝')
    process.exit()
}

script();