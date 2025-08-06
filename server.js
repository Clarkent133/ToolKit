const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const path = require('path');
const { Server } = require("socket.io");
const formidable = require('formidable');
const { Ollama } = require('ollama');
const aiModel = "llama3.2:3b";
const ollama = new Ollama();

const networkInterfaces = os.networkInterfaces();
let localIPs = [];
for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    for (const { address, family, internal } of networkInterface) {
        if (family === 'IPv4' && !internal) {
            localIPs.push(address);
        }
    }
}

const folderRoot = "/"
const rootDirectory = __dirname;
const TEMP_DIR = path.join(rootDirectory, 'temp');
const HOME_DIR = path.join(rootDirectory, 'Home');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(HOME_DIR)) {
    fs.mkdirSync(HOME_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
        let urlParts = req.url.split("%20").join(" ").split('?');
        let urlPath = urlParts[0];
        let queryParams = new URLSearchParams(urlParts[1] || '');
        
        if (!urlPath.includes(".") && urlPath != "/api") {
            urlPath = path.join(urlPath, 'index.html');
        }
        if (urlPath === '/api') {
            if (queryParams.get('fn') === 'version') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({version: "1.1.2837", major: 1, minor: 1, patch: 2837}));
            }
            return;
        }
        if (urlPath === '/export/1.1/html') urlPath = '/Home/Editor/export/1.1/html';
        if (urlPath === '/export/1.1/win') urlPath = '/Home/Editor/export/1.1/win';
        if (urlPath === '/export/1.1/linux') urlPath = '/Home/Editor/export/1.1/linux';

        let filePath = path.join(rootDirectory, urlPath);
        let isDownloadRequest = queryParams.get('download') === 'true';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                const extname = String(path.extname(filePath)).toLowerCase();
                const mimeTypes = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff':'application/font-woff','.ttf':'application/font-ttf','.eot':'application/vnd.ms-fontobject','.otf':'application/font-otf','.ico':'image/x-icon'};
                let contentType = mimeTypes[extname] || 'application/octet-stream';
                const headers = { 'Content-Type': contentType };

                if (isDownloadRequest) {
                    const fileName = path.basename(filePath);
                    headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
                }

                res.writeHead(200, headers);
                res.end(data);
            }
        });
    }

    if (req.method === 'POST') {
        if (req.url === '/upload') {
            const form = new formidable.IncomingForm({
                uploadDir: TEMP_DIR,
                keepExtensions: true,
                multiples: true,
            });

            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('Error parsing form data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error uploading files.');
                    return;
                }

                const directory = Array.isArray(fields.directory) ? fields.directory[0] : fields.directory;
                
                let filesToProcess = [];
                if (files.files) {
                    filesToProcess = Array.isArray(files.files) ? files.files : [files.files];
                }

                if (!directory) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Directory name not provided.');
                    filesToProcess.forEach(file => {
                        if (fs.existsSync(file.filepath)) {
                            fs.unlinkSync(file.filepath);
                        }
                    });
                    return;
                }

                const uploadDir = path.join(rootDirectory, folderRoot, directory);
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                filesToProcess.forEach(file => {
                    const originalFilename = file.originalFilename;
                    const tempFilePath = file.filepath;
                    const filePath = path.join(uploadDir, originalFilename);
                    
                    try {
                        if (fs.existsSync(filePath)) {
                            const parsedPath = path.parse(filePath);
                            let oldFilename = `${parsedPath.name} (old)${parsedPath.ext}`;
                            let oldFilePath = path.join(uploadDir, oldFilename);
                            fs.renameSync(filePath, oldFilePath);
                        }
                        fs.renameSync(tempFilePath, filePath);
                    } catch (e) {
                        console.error(`Error processing file ${originalFilename}:`, e);
                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                        }
                    }
                });

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Files uploaded.');
            });
        }
    }
});








async function askAI(messages, callback) {
    const responseStream = await ollama.chat({
        model: aiModel,
        messages: messages,
        stream: true,
    });
    for await (const chunk of responseStream) {
        const textChunk = chunk.message.content;
        if (textChunk) {
            callback(textChunk);
        }
    }    
    callback("<finish>");
}



const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {

    socket.on("getIP" , () => {
        socket.emit("getIP" , localIPs[0])
    })

    socket.on("getDirectory" , (dir) => {
        const result = [];
        const dirPath = path.join(rootDirectory , folderRoot , dir);
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                let isDirectory = false;
                try {
                    const stats = fs.statSync(itemPath);
                    isDirectory = stats.isDirectory();
                } catch (err) {
                    console.error(`Could not stat ${itemPath}: ${err.message}`);
                }
                result.push({ name: item, directory: isDirectory });
            }
        } catch (err) {
            console.error(`Error reading directory ${dirPath}: ${err.message}`);
        }
        socket.emit("getDirectory" , {dir:dir , files:result});
    });

    socket.on("deleteDirectory" , (dir) => {
        const dirPath = path.join(rootDirectory , folderRoot , dir);
        fs.rmSync(dirPath, { recursive: true, force: true });
    })

    socket.on("makeDirectory", (dir) => {
        const dirPath = path.join(rootDirectory , folderRoot, dir);
        fs.mkdir(dirPath, () => {});
    })

    socket.on("promptAI", (messages) => {
        askAI(messages , (reply) => {socket.emit("promptAI" , reply)});
    })

    socket.on('scrape', (data) => {
        const { url, html1, html2 } = data;
        https.get(url, (res) => {
            let rawHTML = '';
            res.on('data', (chunk) => {
                rawHTML += chunk;
            });
            res.on('end', () => {
                const escapeRegExp = (str) =>
                    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const startPattern = escapeRegExp(html1);
                const endPattern = escapeRegExp(html2);
                const regex = new RegExp(`${startPattern}(.*?)${endPattern}`, 's');
                const match = rawHTML.match(regex);
                if (match && match[1]) {
                    socket.emit('scrape', match[1]);
                } else {
                    socket.emit('scrape', 'Error');
                }
            });
        }).on('error', (err) => {
            console.error('Error fetching data:', err.message);
        });
    });

    socket.on('exec', (data) => {
        const { cmd , value } = data
        const cmds = ["ping", "tracert", "nslookup", "curl"];
        if (!cmds.includes(cmd)) return;
        exec(cmd + " " + value, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`); 
            }
            socket.emit('exec', stdout);
        })
    })

})

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running with Address : ${localIPs[0]}:3000`);
});