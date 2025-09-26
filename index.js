const tmi = require('tmi.js');
const fetch = require('node-fetch');

// Configuração do bot
const client = new tmi.Client({
    options: { debug: true },
    connection: { reconnect: true },
    identity: {
        username: 'yagostoso_bot', // seu bot
        password: 'oauth:71815fa1zpirii3q8v1sk4jx5jckl7' // seu token
    },
    channels: [ 'yagostooso' ] // seu canal
});

client.connect();

// Armazena os últimos avisos por usuário
const avisoCaps = {};

client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    // Ignorar mods, broadcaster e vips
    if (tags.mod || tags.badges?.broadcaster || tags.badges?.vip) return;

    // Detectar caps lock (mensagem longa e toda em maiúsculo)
    const isCaps = message.length > 5 && message === message.toUpperCase();

    if (isCaps) {
        const agora = Date.now();
        const ultimoAviso = avisoCaps[tags.username] || 0;

        // Só avisa se já passou 1 minuto desde o último aviso
        if (agora - ultimoAviso > 60000) {
            try {
                // Apaga a mensagem
                await client.deletemessage(channel, tags.id);

                // Envia aviso
                const respostas = [
                    `⚠️ @${tags.username}, evite usar CAPS LOCK, por favor!`,
                    `🤫 Ei @${tags.username}, sem gritar no chat`,
                    `🙃 @${tags.username}, calma guerreiro, não precisa caps lock`
                ];
                const resposta = respostas[Math.floor(Math.random() * respostas.length)];

                client.say(channel, resposta);

                avisoCaps[tags.username] = agora;
            } catch (err) {
                console.error("Erro ao apagar mensagem:", err);
            }
        }
    }
});
client.on('message', async (channel, tags, message, self) => {
    if (self) return; // Ignorar mensagens do próprio bot

    // Lista de palavras ofensivas (exemplos simplificados)
const palavrasProibidas = [
    "burro","burra","otario","otaria","idiota","imbecil","babaca",
    "vagabundo","vagabunda","cretino","cretina",
    "arrombado","arrombada","desgraçado","desgraçada","merda","porra","puta",
    "piranha","pau no cu","cu","caralho","pinto","rola","piroca","buceta","cacete",
    "bosta","macaca","macaco","estuprada","molestada"
];

// Histórico de infrações
let infracoes = {};

// Função para normalizar mensagens (remove acentos, caracteres especiais, espaços extras e letras repetidas)
function normalizar(msg) {
    return msg
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .replace(/(.)\1+/g, "$1");
}

// Regex para detectar menções às usuárias protegidas
const regexProtegidas = /flavia|flávia|frovinha/i;

// Converte palavras proibidas em regex para detectar palavras semelhantes
    function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapa caracteres especiais
    }
    const regexOfensiva = palavrasProibidas.map(palavra => {
    const safePalavra = escapeRegex(palavra); // Escapa caracteres especiais
    const regexString = safePalavra.replace(/\s+/g, "\\s*").split("").join("\\W*");
    return new RegExp(regexString, "i");
});
    

client.on("message", async (channel, tags, message, self) => {
    if (self) return;

    const usuario = tags.username.toLowerCase();
    const msgNorm = normalizar(message);

    // Verifica se a mensagem menciona qualquer usuária protegida
    if (!regexProtegidas.test(msgNorm)) return;

    // Verifica se contém palavras ofensivas
    const ofensiva = regexOfensiva.some(r => r.test(msgNorm));
    if (!ofensiva) return;

    try {
        // Apaga a mensagem ofensiva
        await client.deletemessage(channel, tags.id);

        // Conta infração do usuário
        if (!infracoes[usuario]) infracoes[usuario] = 0;
        infracoes[usuario]++;

        if (infracoes[usuario] === 1) {
            client.say(channel, `⚠️ @${usuario}, não ofenda a Flávia!`);
        } else if (infracoes[usuario] >= 2) {
            client.say(channel, `⛔ @${usuario} foi silenciado por ofender uma usuária protegida.`);
            await client.timeout(channel, usuario, 600, "Ofensas às usuárias protegidas"); // 10 minutos
            infracoes[usuario] = 0;
        }
    } catch (err) {
        console.error("Erro ao lidar com mensagem ofensiva:", err);
    }
});
    // ====== DETECTAR SPAM AVANÇADO ======
    if (message.length >= 12) {
        const agora = Date.now();

        if (!historicoMensagens[tags.username]) {
            historicoMensagens[tags.username] = [];
        }

        function normalizar(msg) {
            return msg
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/https?:\/\/\S+/g, '')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        const msgNormalizada = normalizar(message);

        historicoMensagens[tags.username].push({ texto: msgNormalizada, tempo: agora });
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

        const parecidas = recentes.filter(m => parecido(m.texto, msgNormalizada));

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
// API Key do OpenWeatherMap
const API_KEY = '5c4882eb17f52678b22baf808608130f';

client.on('message', async (channel, tags, message, self) => {
    if(self) return;

    if(message.toLowerCase().startsWith('!clima ')){
        const cidade = message.slice(7).trim();
        if(!cidade) {
            client.say(channel, `⚠️ @${tags.username}, você precisa digitar o nome de uma cidade!`);
            return;
        }

        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&units=metric&lang=pt_br&appid=${API_KEY}`);
            const data = await res.json();

            if(data.cod !== 200){
                client.say(channel, `❌ Cidade não encontrada, @${tags.username}!`);
                return;
            }

            const cond = data.weather[0].main;
            let condEmoji = '';
            switch(cond){
                case 'Clear': condEmoji = '☀️ Céu limpo'; break;
                case 'Clouds': condEmoji = '☁️ Nublado'; break;
                case 'Rain': condEmoji = '🌧️ Chuva'; break;
                case 'Thunderstorm': condEmoji = '⛈️ Tempestade'; break;
                case 'Snow': condEmoji = '❄️ Neve'; break;
                case 'Mist': condEmoji = '🌫️ Neblina'; break;
                default: condEmoji = '🌡️ Clima indefinido';
            }

            const temp = Math.round(data.main.temp);
            const sensacao = Math.round(data.main.feels_like);

            let tempEmoji = '';
            let mensagemExtra = '';
            if(temp >= 35){
                tempEmoji = '🥵🔥';
                mensagemExtra = 'Tá de fritar ovo no asfalto!';
            } else if(temp >= 25){
                tempEmoji = '😎🌤️';
                mensagemExtra = 'Clima perfeito pra um rolê!';
            } else if(temp >= 15){
                tempEmoji = '🙂🍂';
                mensagemExtra = 'Aquele clima gostosinho.';
            } else if(temp >= 5){
                tempEmoji = '🥶🧣';
                mensagemExtra = 'Se agasalha, tá frio!';
            } else {
                tempEmoji = '🧊❄️';
                mensagemExtra = 'Congelando até a alma!';
            }

            client.say(channel, `${condEmoji} - 🌡️ ${temp}°C (Sensação: ${sensacao}°C) ${tempEmoji} | ${mensagemExtra}`);
        } catch (err){
            console.error(err);
            client.say(channel, `❌ Erro ao buscar o clima, @${tags.username}.`);
        }
    }
});
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot ativo!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
