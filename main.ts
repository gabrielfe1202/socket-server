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

class User {
    private messages: string[];

    constructor(public id: string) {
        this.messages = [];
    }

    addMessage(message: string) {
        this.messages.push(message);
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

    socket.on('MESSAGE', (msg: string) => {
        console.log('Message: ' + msg + '| id:' + socket.id);
        session.findUser(socket.id)?.addMessage(msg)
        session.save()
        io.emit('MESSAGE', { text: msg, client: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        session.dropUser(socket.id)
        session.save()
    });
});

server.listen(3000, '10.3.58.27', () => {
    console.log(`Server is running on http://localhost:3000`);
});