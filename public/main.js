document.addEventListener("DOMContentLoaded", () => {
    const attendanceForm = document.getElementById("attendanceForm");
    const startScannerButton = document.getElementById("startScanner");

    const classData = JSON.parse(localStorage.getItem('classData'));//選択されたクラスを取得


    // const classData = sessionStorage.getItem('classData'); //選択されたクラスを取得
    const classId = document.getElementById("classId");

    classId.textContent = `${classData.クラス}の出席管理`;

    //const scannerContainer = document.getElementById("scanner-container");
    //let attendanceRecords = [];



    // 出席を記録
    attendanceForm.addEventListener("submit", (e) => {

        e.preventDefault(); // デフォルトのフォーム送信を防ぐ

        // 入力された学籍番号を取得
        const studentId = document.getElementById('studentId').value.trim();

        if (!studentId) {
            return;
        }


        fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ studentId: studentId }) // ここでstudentIdが正しく渡されているか確認
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const student = data.student;

                    //入力されたクラスと選択されたクラスの比較
                    if (student.クラス == classData.クラス) {
                        document.getElementById("error-message").innerText = "";
                        document.getElementById("error-message").style.display = "none";
                        updateAttendanceList(student);
                    } else {
                        document.getElementById("error-message").innerText = `${classData.クラス}の学生ではありません。`;
                        document.getElementById("error-message").style.display = "block";
                        //alert("違うクラスです");
                    }


                } else {
                    document.getElementById("error-message").innerText = `学生ではありません`;
                    document.getElementById("error-message").style.display = "block";
                    //alert(data.message);
                }
            })
            .catch(error => console.error('エラー:', error));


        // 入力フィールドをクリア
        document.getElementById('studentId').value = '';
    });

    // QuaggaJSでバーコードスキャンを開始
    startScannerButton.addEventListener("click", () => {
        const barcodeValueElement = document.getElementById('barcodeValue');
        const startScanner = document.getElementById('startScanner');
        startScanner.style.display = 'none';


        // const video = document.querySelector('#scanner-container');

        // if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        //     navigator.mediaDevices.getUserMedia({ video: true })
        //         .then(stream => {
        //             video.srcObject = stream;
        //             video.play();
        //         })
        //         .catch(err => {
        //             console.error('カメラへのアクセスに失敗しました:', err);
        //         });
        // } else {
        //     console.error('このブラウザではカメラ機能がサポートされていません。');
        // }



        // Quaggaの初期化
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.getElementById('scanner-container'), // カメラ映像を表示するコンテナ
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment" // リアカメラ
                },
                willReadFrequently: true, // キャンバスのパフォーマンスを向上
            },
            frequency: 1, // スキャン頻度
            decoder: {
                readers: ["code_128_reader"] // 読み取るバーコードの種類
            }
        }, function (err) {
            if (err) {
                console.error("Quagga initialization failed: ", err);
                return;
            }
            console.log("Quagga initialization succeeded");



            // Quaggaを開始して、カメラ映像を表示
            Quagga.start();
        });


        let lastDetectedTime = 0; // 最後に検出した時間を保持
        let lastDetectedCode = ''; // 最後に検出されたバーコード

        Quagga.onDetected(function (result) {
            const code = result.codeResult.code;
            const currentTime = Date.now();

            // ここでは3秒 (3000ms) の間隔を設定し、かつ前回と同じバーコードの場合は無視
            if (currentTime - lastDetectedTime > 3000 && code !== lastDetectedCode) {
                lastDetectedTime = currentTime;
                lastDetectedCode = code; // 最後に検出されたコードを更新

                barcodeValueElement.textContent = code; // 読み取ったバーコードを表示
                studentId = code;

                // サーバーにPOSTリクエストを送信して学生を検索
                fetch('/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ studentId })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const student = data.student;
                            updateAttendanceList(student);
                        } else {
                            //alert(data.message);

                            document.getElementById("error-message").innerText = `${classData.クラス}の学生ではありません。`;
                            document.getElementById("error-message").style.display = "block";
                        }
                    })
                    .catch(error => console.error('エラー:', error));
            }
        });


    });

    //10より小さいときに先頭に0をつける関数
    function twoFormat(data) {
        return data < 10 ? "0" + data : data;
    }


    // 出席リストをページ上に表示する関数
    function updateAttendanceList(student) {
        let date = new Date(); // 日付取得
        const listItem = document.createElement('li');
        const datejp = `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日 ${twoFormat(date.getHours())}時${twoFormat(date.getMinutes())}分`;
        listItem.innerHTML = `学籍番号：${student.学籍番号} - 名前：${student.名前}<br>${datejp}  出席`;




        const studentId = student.学籍番号;
        const studentName = student.名前;

        //alert(`学生情報: 学籍番号: ${student.学籍番号}, 名前: ${student.名前}`);


        const attendanceList = document.getElementById('attendanceList'); // 出席リスト要素を取得

        // 一番上に挿入する
        if (attendanceList.firstChild) {
            attendanceList.insertBefore(listItem, attendanceList.firstChild);
        } else {
            attendanceList.appendChild(listItem); // リストが空の場合
        }


        // サーバーにPOSTリクエストを送信
        fetch('http://localhost:3000/record-attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ studentId, datejp, studentName }) // 学籍番号を送信
        })
            .then(response => response.text())
            .then(data => {
                //alert(data); // サーバーからの応答メッセージを表示
                document.getElementById('studentId').value = ''; // フォームの入力フィールドをクリア
            })
            .catch(error => console.error('Error:', error));
    }






});



// function toggleMenu() {
//     const menu = document.getElementById('menu');
//     if (menu.style.display === 'flex') {
//         menu.style.display = 'none';
//     } else {
//         menu.style.display = 'flex';
//     }
// }

// const menu = document.getElementById('menu');
// const menuLogo = document.getElementById('menuLogo');

// // マウスが乗ったとき
// menuLogo.addEventListener('mouseenter', () => {
//     menu.style.display = 'flex';
// });

// // マウスが乗ったとき
// menu.addEventListener('mouseenter', () => {
//     menu.style.display = 'flex';
// });

// // // マウスが離れたとき
// // menuL.addEventListener('mouseleave', () => {
// //     menu.style.display = 'none';
// // });

// menu.addEventListener('mouseleave', () => {
//     menu.style.display = 'none';
// });


