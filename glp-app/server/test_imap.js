const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
require('dotenv').config();

const config = {
    imap: {
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

async function testImap() {
    console.log("Connecting to IMAP:", config.imap.user);
    try {
        const connection = await imaps.connect(config);
        console.log("Connected successfully!");
        
        await connection.openBox('INBOX');
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true, markSeen: false };
        
        console.log("Searching for UNSEEN emails...");
        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Found ${messages.length} unseen messages.`);
        
        for (let item of messages) {
            const all = item.parts.find(p => p.which === 'TEXT');
            const id = item.attributes.uid;
            const idHeader = "Imap-Id: "+id+"\r\n";
            const mail = await simpleParser(idHeader + all.body);
            console.log(`Email UID: ${id}`);
            console.log(`Subject: ${mail.subject}`);
            console.log(`From: ${mail.from.text}`);
        }
        
        connection.end();
    } catch (e) {
        console.error("IMAP Error:", e);
    }
}

testImap();
