const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const upload = multer();
let messages = {};

app.use(express.static(path.join(__dirname, 'public')));

app.post('/create-message', upload.none(), (req, res) => {
    const id = uuidv4();
    const token = uuidv4();
    const expirationTime = parseInt(req.body.expiration, 10) * 1000; // Convert to milliseconds

    messages[id] = {
        type: 'text',
        content: req.body.message,
        expiresAt: Date.now() + expirationTime,
        token: token,
        recipientNumber: req.body.recipientNumber
    };

    console.log('Message created:', messages[id]);

    setTimeout(() => {
        deleteMessage(id);
    }, expirationTime);

    res.json({ id, token });
});

app.get('/message/:id', (req, res) => {
    const id = req.params.id;
    const token = req.query.token;
    const recipientNumber = req.query.recipientNumber;
    const message = messages[id];

    if (!message || message.token !== token) {
        return res.status(404).send('Message not found, has expired, or token is invalid.');
    }

    if (message.recipientNumber !== recipientNumber) {
        return res.status(403).send('This message was not intended for you.');
    }

    res.send(`<p>${message.content}</p>`);
});

function deleteMessage(id) {
    const message = messages[id];
    console.log('Deleting message:', message);

    if (message) {
        // Notify all clients that the message has expired
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ id, expired: true }));
            }
        });
    }

    delete messages[id];
}

wss.on('connection', ws => {
    ws.on('message', message => {
        console.log('received: %s', message);
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
