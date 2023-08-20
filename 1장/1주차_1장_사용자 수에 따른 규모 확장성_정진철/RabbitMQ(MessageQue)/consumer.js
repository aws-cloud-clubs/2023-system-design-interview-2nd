const app = express();
import express from "express";
import bodyParser from "body-parser";
import amqp from "amqplib";

app.use(bodyParser.json());


// API 요청을 처리하는 곳.
// 해당 메시지 마다 requestId를 할당시키고 이를 rabbitMQ에 보내고 어떤 아이디를 보냈는지 requestId를 응답.
// ProcessorService 의 결과를 수신하고 기록.


//요청 아이디.
let lastRequestId = 1;

const messageQueueConnectionString =  'amqp://guest:guest@127.0.0.1:5672/';

//API 요청 처리
const listenForMessages = async ()=>{
    //채널을 연결
    const connection = await amqp.connect(messageQueueConnectionString);
    const channel = await connection.createChannel();
    await channel.prefetch(1);

    await consume({connection, channel});
}

const consume =  ({connection, channel}) =>{
    return new Promise((resolve, reject)=>{
        // 원하는 Queue의 이름을 적어준다.
        channel.consume('TestQue',async (msg)=>{
            // 1. 받은 메시지를 파싱하고.
            const msgBody = msg.content.toString();
            const data = JSON.parse(msgBody);

            // 1-1. 뭘 받았는지 출력해보자.
            console.log('Received Data : ',data);

            // 2. 잘 받았으니 ACK를 보내자.
            await channel.ack(msg);
        })

        // Queue가 닫혔거나. 에러가 발생하면 reject
        connection.on('close',(err)=>{
            return reject(err);            
        })

        connection.on('error',(err)=>{
            return reject(err);            
        })
    })
}

listenForMessages();