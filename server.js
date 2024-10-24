const fs = require('fs');
const express = require('express');
const connectToDatabase = require('./config/db'); // MongoDB接続用
//const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');
const app = express();
const port = 3000; // サーバーのポート番号

// MongoDB接続情報
const mongoUrl = 'mongodb://localhost:27017'; // MongoDBのURL
const dbName = 'student'; // データベース名
//const collectionName = 'student1'; // コレクション名

let dbClient; // MongoClientインスタンスを保持する変数


// Google Sheets APIの認証情報
let auth;

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// POSTリクエストのパース設定
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ルートパスへのアクセスに対して、select.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'select.html'));
});

// Google Sheetsの認証情報を読み込み

fs.readFile('credentials.json', (err, content) => {
    if (err) {
        console.error('Error loading client secret file:', err);
        return;
    }
    // 認証プロセスの開始
    authorize(JSON.parse(content), appendData);
});

// 認証プロセスを行う関数
function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // 保存されたトークンを使って認証
    fs.readFile('token.json', (err, token) => {
        if (err) {
            return getNewToken(oAuth2Client);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        auth = oAuth2Client; // 認証オブジェクトを保持
    });
}

// 新しいトークンを取得する関数
function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log('Authorize this app by visiting this url:', authUrl);
}

// 学籍番号と出席情報をGoogle Sheetsに書き込むAPI
app.post('/record-attendance', (req, res) => {
    const { studentId, studentName, datejp: timestamp } = req.body; // リクエストからデータを取得

    // Google Sheetsにデータを追加
    appendData(studentId, timestamp, studentName)
        .then(() => {
            res.status(200).send('Attendance recorded successfully!');
        })
        .catch((err) => {
            console.error('Error recording attendance:', err);
            res.status(500).send('Failed to record attendance.');
        });
});

// Google Sheetsにデータを追加する関数
function appendData(studentId, timestamp, studentName) {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1JL30KOR5HgNxvA1X0EXySPCCdnIIactZsgA23-YOegw'; // スプレッドシートID
    const range = 'Sheet1!A1'; // 書き込み範囲

    const values = [
        [studentId, studentName, timestamp]
    ];

    const resource = { values };

    // Google Sheets APIでデータをスプレッドシートに追加
    return sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource,
    });
}

// 学籍番号でMongoDBから学生データを検索
app.post('/search', async (req, res) => {
    const { studentId } = req.body; // リクエストから学籍番号を取得

    try {
        const { client, db } = await connectToDatabase(mongoUrl, dbName); // データベースに接続
        dbClient = client; // clientを保持

        // 学籍番号で学生情報を検索
        const student = await db.collection('student1').findOne({ 学籍番号: studentId });

        if (student) {
            res.json({ success: true, student });
        } else {
            res.json({ success: false, message: '学生が見つかりませんでした。' });
        }

        // 使用後にMongoDB接続を閉じる
        await client.close();
    } catch (error) {
        console.error('エラーが発生しました:', error);
        res.json({ success: false, message: 'エラーが発生しました。' });
    } finally {

    }
});


// クラス選択
app.post('/submit', async (req, res) => {
    const selectedClass = req.body.classId; // 選択されたクラスを取得
    try {
        const { client, db } = await connectToDatabase(mongoUrl, dbName); // データベースに接続
        dbClient = client; // clientを保持

        const classData = await db.collection('class').findOne({ クラス: selectedClass }); // クラスのデータを取得
        //const classList = await db.collection('student1').findOne({ クラス: selectedClass }); // クラスリストを取得


        if (classData) {
            res.json({ success: true, classData });

        } else {
            res.json({ success: false, message: 'クラスがありません' });
        }
    } catch (error) {
        console.error('Error fetching class data:', error);
        res.status(500).send('エラーが発生しました。もう一度お試しください。');
    }
});





// サーバーを起動
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Graceful Shutdown (MongoDB接続は各リクエスト後に閉じるため、サーバーはすぐに終了できる)
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    process.exit(0);
});
