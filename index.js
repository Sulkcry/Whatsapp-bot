require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const PREFIX = '.';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    browser: ['Sulkcry-Bot', 'Chrome', '1.0']
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      console.log('\nEscaneie o QR Code abaixo com o WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada. Reconectando...', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('🤖 Bot conectado com sucesso!');
      console.log('Número do bot: 559881045916');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const type = Object.keys(msg.message)[0];
    let body = '';

    if (type === 'conversation') {
      body = msg.message.conversation;
    } else if (type === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage.text;
    } else {
      return;
    }

    if (body.startsWith(PREFIX)) {
      const [cmd, ...args] = body.slice(1).split(' ');
      if (cmd.toLowerCase() === 'crieme') {
        if (args[0]?.toLowerCase() === 'um' && args[1]?.toLowerCase() === 'texto') {
          const prompt = args.slice(2).join(' ');
          if (!prompt) {
            await sock.sendMessage(from, { text: 'Use: .crieme um texto <seu prompt>' });
            return;
          }
          await sock.sendMessage(from, { text: 'Gerando texto, aguarde...' });
          try {
            const response = await axios.post(
              'https://api-inference.huggingface.co/models/gpt2',
              { inputs: prompt },
              { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } }
            );
            const result = response.data[0]?.generated_text || '[Falha ao gerar texto]';
            await sock.sendMessage(from, { text: result });
          } catch (e) {
            await sock.sendMessage(from, { text: 'Erro ao acessar a API de texto.' });
          }
        }
      }
    }
  });
}

startBot();