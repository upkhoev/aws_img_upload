const config = require('config');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
// const fs = require('fs');
const sharp = require('sharp');
const Queue = require('bull');
const port = 3000;
const uploadQueue = new Queue('image uploading', {redis: config.get('redis')});

app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

const contentTypes = config.get('contentType');
if (!contentTypes || !contentTypes.length) {
    throw new Error('Configure content types');
}

for (let i = 0; i < contentTypes.length; i++) {
    app.use(bodyParser.raw({
        type: contentTypes[i],
        limit: config.get('maxUploadSize'),
        verify: (req, res, buf, encoding) => {
            req.isImg = req.headers['content-type'].indexOf('image') !== -1;
        }
    }));
}

app.use(errorHandler);

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    res.status(500);
    res.send(err);
}

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`)
});

// параметры сжатия изображения
const resizeImageParams = {
    "large": [1024, 1024], // [width, height]
    "medium": [512, 512],
    "thumb": [200, 200]
};

app.post(/.*/, async function (req, res) {
    const fileName = decodeURIComponent(req.originalUrl.slice(1));
    console.log('request upload: ' + fileName);

    if (req.body.length) {
        const fileExt = fileName.split('.').pop();
        const name = fileName.split('.')[0];
        if (req.isImg) {
            // изображение нужно привести к размерам
            const sf = sharp(req.body);
            const metadata = await sf.metadata();

            for (let size in resizeImageParams) {
                const width = resizeImageParams[size][0];
                const height = resizeImageParams[size][1];
                const sizedFilename = name + '_' + size + '.' + fileExt;
                if (metadata.width < width || metadata.height < height) {
                    // меньше размером, не нужно сжимать
                    continue;
                }
                const resizedImg = sf.resize(width, height);
                // resizedImg.toFile(name + '_' + size + '.' + fileExt, (err, info) => {});
                uploadQueue.add({
                    filename: sizedFilename,
                    data: await resizedImg.toBuffer()
                });
            }
        } else {
            uploadQueue.add({
                filename: fileName,
                data: req.body
            });

            /* fs.writeFile(fileName, req.body, "binary", function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("The file was saved!");
                }
            });*/
        }
        res.status(200).send('success');
    } else {
        res.status(500).send('unsupported type');
    }

});