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

class Message  {
    public name: string;    

    constructor(public text: string,public client: string,public type?: string){
        this.name = '';        
    }
};
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

    setInfos({name, room}:any){
        this.name = name;
        this.room = room;
    }

    setRoom(room: string){
        this.room = room
    }

    getName(): string{
        return this.name
    }

    getRoom(): string{
        return this.room || ''
    }

}

class Room {
    public messages: Message[];
    private users: User[];

    constructor(public id: string){
        this.messages = [];
        this.users = [];
    }

    addMessage(message: Message) {
        this.messages.push(message);
    }

    addUser(user: User){
        this.users.push(user);
    }

    dropUser(userId: string){
        this.users = this.users.filter(({ id }) => id !== userId);
    }

    findUser(userId: string): User | null {
        const user = this.users.find(u => u.id === userId)

        return user ?? null;
    }

    listMessage(): Message[] {
        return this.messages
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

class UserSession {
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

class RoomSession {
    private rooms: Room[] = [];

    constructor(private persistence: Persistence) { }

    save() {
        this.persistence.save(this.rooms);
    }

    addRoom(room: Room) {
        this.rooms.push(room);
        console.log(this.rooms)
    }

    findRoom(roomId: string): Room | null {
        const room = this.rooms.find(r => r.id === roomId)

        return room ?? null;
    }    

}

const persistence = new Persistence('session.json', '[]');
const session = new UserSession(persistence);

const persistenceRoom = new Persistence('rooms.json', '[]');
const sessionRoom = new RoomSession(persistenceRoom);

io.on('connection', (socket) => {
    session.addUser(new User(socket.id));        
    session.save();

    console.log('A user connected');

    socket.on('JOIN', ({room, name}) => {
        let user = session.findUser(socket.id);                
        io.to(user?.getRoom() || '').emit('MESSAGE', { text: user?.getName() + " entrou", type: 'Alert' });        
        socket.join(room);                
        session.findUser(socket.id)?.setInfos({name, room});                
        session.save()
        
        if(sessionRoom.findRoom(room) == null){                               
            var x = new Room(room)
            x.addUser(user || new User(socket.id));
            sessionRoom.addRoom(x);                    
        }else if(sessionRoom.findRoom(room)?.findUser(socket.id) == null){
            sessionRoom.findRoom(room)?.addUser(session.findUser(socket.id) || new User(socket.id))
        }

        sessionRoom.save()

        socket.emit('previousMessages', sessionRoom.findRoom(room)?.listMessage());
        

    });

    socket.on("MESSAGEROOM",(msg: string) => {        
        let user = session.findUser(socket.id);        
        var message = new Message(msg,socket.id,'Message')
        message.name = user?.getName() || ''
        sessionRoom.findRoom(user?.getRoom() || '')?.addMessage(message)
        sessionRoom.save()
        user?.addMessage(msg)
        session.save()
        io.to(user?.getRoom() || '').emit('MESSAGE', { text: msg, client: socket.id, name: user?.getName(), type: 'Message' });
    })

    socket.on('leaveRoom', () => {
        let user = session.findUser(socket.id);        
        sessionRoom.findRoom(user?.getRoom() || '')?.dropUser(socket.id)
        sessionRoom.save()
        socket.leave(user?.getRoom() || '');        
        io.to(user?.getRoom() || '').emit('MESSAGE', { text: user?.getName() + " saiu", type: 'Alert' });        
       user?.setRoom("");        
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        session.dropUser(socket.id)
        session.save()
    });
});

server.listen(3000, '192.168.15.18', () => {
    console.log(`Server is running on http://localhost:3000`);
});