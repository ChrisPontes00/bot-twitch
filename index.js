// ================= DEPENDÊNCIAS =================
const tmi = require('tmi.js');
const fetch = require('node-fetch');
const express = require('express');

// ================= EXPRESS 24/7 =================
const app = express();
app.get("/", (req, res) => res.send("Bot ativo!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// ================= TWITCH BOT =================
const client = new tmi.Client({
    options: { debug: true },
    connection: { reconnect: true },
    identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: process.env.TWITCH_OAUTH
    },
    channels: [ process.env.CHANNEL_NAME ]
});

client.connect().catch(console.error);

// ================= CAPS LOCK =================
const avisoCaps = {};
client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    if (tags.mod || tags.badges?.broadcaster || tags.badges?.vip) return;

    const isCaps = message.length > 5 && message === message.toUpperCase();
    if (!isCaps) return;

    const agora = Date.now();
    const ultimoAviso = avisoCaps[tags.username] || 0;
    if (agora - ultimoAviso > 60000) {
        try {
            await client.deletemessage(channel, tags.id);
            const respostas = [
                `⚠️ @${tags.username}, evite usar CAPS LOCK!`,
                `🤫 @${tags.username}, sem gritar no chat`,
                `🙃 @${tags.username}, calma, não precisa caps lock`
            ];
            const resposta = respostas[Math.floor(Math.random() * respostas.length)];
            client.say(channel, resposta);
            avisoCaps[tags.username] = agora;
        } catch (err) {
            console.error("Erro ao apagar caps:", err);
        }
    }
});

// ================= PALAVRAS OFENSIVAS =================
const palavrasProibidas = [
    "burro","burra","otario","otaria","idiota","imbecil","babaca",
    "vagabundo","vagabunda","cretino","cretina","arrombado","arrombada",
    "desgraçado","desgraçada","merda","porra","puta","macaca","macaco"
];
let infracoes = {};

// Normaliza mensagens
function normalizar(msg) {
    return msg.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .replace(/(.)\1+/g, "$1");
}

// Escapa caracteres especiais para regex
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Regex de usuários protegidos
const regexProtegidas = /flavia|flávia|frovinha/i;

// Regex de palavras ofensivas (camuflagem)
const regexOfensiva = palavrasProibidas.map(palavra => {
    const safe = escapeRegex(palavra);
    const regexStr = safe.replace(/\s+/g, "\\s*").split("").join("\\W*");
    return new RegExp(regexStr, "i");
});

// ================= DETECÇÃO OFENSAS =================
client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    const usuario = tags.username.toLowerCase();
    const msgNorm = normalizar(message);

    if (!regexProtegidas.test(msgNorm)) return;

    const ofensiva = regexOfensiva.some(r => r.test(msgNorm));
    if (!ofensiva) return;

    try {
        await client.deletemessage(channel, tags.id);

        if (!infracoes[usuario]) infracoes[usuario] = 0;
        infracoes[usuario]++;

        if (infracoes[usuario] === 1) {
            client.say(channel, `⚠️ @${usuario}, não ofenda a Flávia ou Frovinha!`);
        } else if (infracoes[usuario] >= 2) {
            client.say(channel, `⛔ @${usuario} foi silenciado por ofender uma usuária protegida.`);
            await client.timeout(channel, usuario, 600, "Ofensas às usuárias protegidas");
            infracoes[usuario] = 0;
        }
    } catch (err) {
        console.error("Erro ao lidar com mensagem ofensiva:", err);
    }
});

// ================= DETECÇÃO SPAM =================
let historicoMensagens = {};
client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    if (message.length >= 12) {
        const agora = Date.now();
        if (!historicoMensagens[tags.username]) historicoMensagens[tags.username] = [];

        const msgNorm = normalizar(message);
        historicoMensagens[tags.username].push({ texto: msgNorm, tempo: agora });
        historicoMensagens[tags.username] = historicoMensagens[tags.username].slice(-10);

        const recentes = historicoMensagens[tags.username].filter(m => agora - m.tempo < 30000);

        function parecido(msg1, msg2) {
            const len = Math.max(msg1.length, msg2.length);
            if (len === 0) return true;
            let iguais = 0;
            for (let i = 0; i < Math.min(msg1.length, msg2.length); i++) {
                if (msg1[i] === msg2[i]) iguais++;
            }
            return (iguais / len) >= 0.7;
        }

        const parecidas = recentes.filter(m => parecido(m.texto, msgNorm));

        if (parecidas.length === 4) {
            try {
                await client.deletemessage(channel, tags.id);
                client.say(channel, `⚠️ @${tags.username}, evite repetir mensagens, isso é SPAM!`);
            } catch (err) {
                console.error("Erro ao apagar spam:", err);
            }
        }

        if (parecidas.length === 8) {
            try {
                client.say(channel, `⛔ @${tags.username} foi silenciado por spam! (10 minutos)`);
                await client.timeout(channel, tags.username, 600, "Spam detectado");
            } catch (err) {
                console.error("Erro ao aplicar timeout:", err);
            }
        }
    }
});

// ================= COMANDO CLIMA =================
const API_KEY = process.env.OPENWEATHER_API_KEY;
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    if (message.toLowerCase().startsWith('!clima ')) {
        const cidade = message.slice(7).trim();
        if (!cidade) {
            client.say(channel, `⚠️ @${tags.username}, digite o nome de uma cidade!`);
            return;
        }

        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&units=metric&lang=pt_br&appid=${API_KEY}`);
            const data = await res.json();

            if (data.cod !== 200) {
                client.say(channel, `❌ Cidade não encontrada, @${tags.username}!`);
                return;
            }

            const cond = data.weather[0].main;
            const temp = Math.round(data.main.temp);
            const sensacao = Math.round(data.main.feels_like);

            let condEmoji = '';
            switch (cond) {
                case 'Clear': condEmoji = '☀️ Céu limpo'; break;
                case 'Clouds': condEmoji = '☁️ Nublado'; break;
                case 'Rain': condEmoji = '🌧️ Chuva'; break;
                case 'Thunderstorm': condEmoji = '⛈️ Tempestade'; break;
                case 'Snow': condEmoji = '❄️ Neve'; break;
                case 'Mist': condEmoji = '🌫️ Neblina'; break;
                default: condEmoji = '🌡️ Clima indefinido';
            }

            let tempEmoji = '';
            let msgExtra = '';
            if (temp >= 35) { tempEmoji = '🥵🔥'; msgExtra = 'Tá de fritar ovo no asfalto!'; }
            else if (temp >= 25) { tempEmoji = '😎🌤️'; msgExtra = 'Clima perfeito pra um rolê!'; }
            else if (temp >= 15) { tempEmoji = '🙂🍂'; msgExtra = 'Aquele clima gostosinho.'; }
            else if (temp >= 5)  { tempEmoji = '🥶🧣'; msgExtra = 'Se agasalha, tá frio!'; }
            else { tempEmoji = '🧊❄️'; msgExtra = 'Congelando até a alma!'; }

            client.say(channel, `${condEmoji} - 🌡️ ${temp}°C (Sensação: ${sensacao}°C) ${tempEmoji} | ${msgExtra}`);
        } catch (err) {
            console.error(err);
            client.say(channel, `❌ Erro ao buscar o clima, @${tags.username}.`);
        }
    }
});
