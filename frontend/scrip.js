// async function uploadreceipt(){
//     const receiptFile=document.getElementById('receiptFile');
//     const file=receiptFile.files[0];

//     if(!file || file.type !='application/pdf'){
//         alert('Please select a valid PDF file');
//         return;
//     }
//     const Filename=file.name;
//     const url=`https://projcect-receipt-bucket.s3.us-east-1.amazonaws.com/receipts/${Filename}`;
//     try{
//     const res=await fetch(url,{
//         method:'PUT',
//         headers: {
//             'Content-Type': 'application/pdf',
//         },
//         body: file,
//     });

//     if(res.ok){
//         alert("File Uploaded succesfully");
//         console.log("File url:",url);
//     }else{
//         alert("Error uploading file");
//     }
//     }catch(error){
//         console.error("Error:",error);
//     }
// }

async function uploadreceipt(){
    const receiptFile=document.getElementById('receiptFile');
    const file=receiptFile.files[0];

    if(!file || file.type!='application/pdf'){
        alert('Please select a valid PDF file');
        return;
    }

    const res=await fetch('https://duqt95s9ec.execute-api.us-east-1.amazonaws.com/prob/upload-url',{
        method : 'POST',
        headers:{
            'Content-Type': 'application/pdf',
        },
        body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
        }),
    });

    if(!res.ok){
        alert("Error fetching signed URL");
        return;
    }
    const { signedUrl }=await res.json();
    console.log("Upload:",signedUrl);

    const upload=await fetch(signedUrl,{
        method : 'PUT',
        headers:{
            'Content-Type': file.type,
        },
        body: file,
    });

    if(upload.ok){
        alert('File Uploaded succesfully');
        console.log('File url:',signedUrl);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchReceipts();
    }else{
        alert("Upload failed");
    }
}

async function fetchReceipts() {
      try {
        const response = await fetch("https://d6m2pjdaaf.execute-api.us-east-1.amazonaws.com/s1/ReceiptsTable");
        const data = await response.json();

        const sort=data.sort((a,b)=>new Date(b.processed_timestamp)- new Date(a.processed_timestamp));
        const recent=sort[0];

        const list = document.getElementById("receiptList");
        list.innerHTML = "";

        if(recent){
            const li = document.createElement("li");
            li.innerHTML = `<strong>${recent.vendor}</strong><br><span>${recent.date}</span><br><span class='amount'>${recent.total}</span>`;
            list.appendChild(li);
        }else{
            list.innerHTML= "<li> NO list found </li>";
        }
      } catch (err) {
        console.error("Error fetching receipts", err);
      }
    }

    // window.onload = fetchReceipts;
