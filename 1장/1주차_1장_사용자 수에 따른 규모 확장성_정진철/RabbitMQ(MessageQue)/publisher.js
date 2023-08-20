import amqp from "amqplib";

const messageQueueConnectionString = 'amqp://guest:guest@127.0.0.1:5672/';


const sendMessage = async () => {
    const connection = await amqp.connect(messageQueueConnectionString);
    const channel = await connection.createConfirmChannel();
    let counter = 1;

    await setInterval(() => {
        //메시지 카운터는 늘어나고..
        const msg = `hello ${counter++}`;
        console.log(msg);
        publishToChannel(channel, {
            routingKey: 'systemDesignStudy',
            exchangeName: 'Test',
            data: { Message: msg },
        });
        //3초마다 전송
    }, 3000);
};

const publishToChannel = (channel, { routingKey, exchangeName, data }) => {
    return new Promise((resolve, reject) => {
        //1. Publish할 때는 Exchange이름, RoutingKey를 넣어주고.
        channel.publish(exchangeName,routingKey,    

            // 2. 메시지를 보낼때는 직렬화 후 버퍼에 담아서.      
            Buffer.from(JSON.stringify(data), 'utf-8'),

            // 3. 설정 후
            { persistent: true },

            // 4. 메시지 보낸 이후 Promise return
            (err, ok) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            }
        );
    });
};

sendMessage();