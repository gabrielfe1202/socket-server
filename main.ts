import express from 'express';
import http from 'http';
import cors from 'cors';
import * as fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.use(cors({ origin: '*' }));
app.use(express.static('public'));

//https://dribbble.com/shots/23835876-Fashion-Shopify-Template

class User {
    private name: string;
    private room: string;
    private messages: string[];

    constructor(public id: string) {
        this.messages = [];
        this.name = "";
        this.room = "";
    }

    addMessage(message: string) {
        this.messages.push(message);
    }

    setData({name, room}:any){
        this.name = name;
        this.room = room;
    }

    getName(): string{
        return this.name
    }

    getRoom(): string{
        return this.room || ''
    }

}

class Persistence {
    constructor(
        private filePath: string,
        defaultValue: string = '{}'
    ) {
        fs.writeFileSync(filePath, defaultValue);
    }

    save(data: any) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, undefined, 2));
    }
}

class Session {
    private users: User[] = [];

    constructor(private persistence: Persistence) { }

    save() {
        this.persistence.save(this.users);
    }

    addUser(user: User) {
        this.users.push(user);
    }

    findUser(userId: string): User | null {
        const user = this.users.find(u => u.id === userId)

        return user ?? null;
    }

    dropUser(userId: string) {
        this.users = this.users.filter(({ id }) => id !== userId);
    }
}

const persistence = new Persistence('session.json', '[]');
const session = new Session(persistence);

io.on('connection', (socket) => {
    session.addUser(new User(socket.id));        
    session.save();

    console.log('A user connected');
    
    socket.on('JOIN', ({room, name}) => {
        let user = session.findUser(socket.id);                
        
        socket.join(room);        
        io.to(user?.getRoom() || '').emit('MESSAGE', { name: user?.getName(), type: 'Alert' });
        session.findUser(socket.id)?.setData({name, room});                
        session.save()
        
    });

    socket.on("MESSAGEROOM",(msg: string) => {        
        let user = session.findUser(socket.id);        
        user?.addMessage(msg)
        session.save()
        io.to(user?.getRoom() || '').emit('MESSAGE', { text: msg, client: socket.id, name: user?.getName(), type: 'Message' });
    })

    socket.on('disconnect', () => {
        console.log('User disconnected');
        session.dropUser(socket.id)
        session.save()
    });
});

server.listen(3000, '10.3.41.20', () => {
    console.log(`Server is running on http://localhost:3000`);
});