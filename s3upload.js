const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

const AWS = require('aws-sdk');
const Queue = require('bull');
const config = require('config');

const awsConfig = config.get('aws');
AWS.config.update({
    region: awsConfig.region
});

const s3 = new AWS.S3({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
});

const redisConfig = config.get('redis');
const uploadQueue = new Queue('image uploading', {redis: redisConfig});
console.log('watch queue...');

uploadQueue.process(function(job, done) {
    console.log('new job. upload file: ', job.data.filename);

    const dt = new Date();
    const pathId = Math.random().toString(36).substr(2, 9);

    // call done when finished
    s3.upload({
        Bucket: awsConfig.bucket,
        Key: '' + dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate() + '/' + pathId + '/' + job.data.filename,
        Body: new Buffer(job.data.data),
        ACL: 'public-read'
    }, function (err, data) {
        if (err) {
            console.error(err);
            throw err;
        } else {
            done();
            console.log(`File uploaded successfully. ${data.Location}`);
        }
    });

});

