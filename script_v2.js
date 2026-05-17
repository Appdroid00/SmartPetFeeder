let isFeeding=false;

let scheduleState=
["Pending","Pending","Pending"];

let feedHistory=[];

let lastTriggerTime=
["","",""];




// ================= SAVE =================

function save(){

let t1=
document.getElementById(
"time1").value;

let t2=
document.getElementById(
"time2").value;

let t3=
document.getElementById(
"time3").value;



firebase.database()

.ref("schedule")

.set({

time1:t1,

time2:t2,

time3:t3

})

.then(()=>{

if(t1)
scheduleState[0]=
"Scheduled";

if(t2)
scheduleState[1]=
"Scheduled";

if(t3)
scheduleState[2]=
"Scheduled";


updateUI();

});

}





// ================= CHECK SCHEDULE =================

setInterval(()=>{

let now=
new Date()

.toTimeString()

.slice(0,5);


let times=[

time1.value,

time2.value,

time3.value

];


times.forEach((t,i)=>{

if(

t &&

scheduleState[i]
=="Scheduled"

&&

now==t

&&

lastTriggerTime[i]
!=now

){

lastTriggerTime[i]=
now;



firebase.database()

.ref("feedNow")

.set(1)

.then(()=>{


// WAIT FOR SERVO

setTimeout(()=>{

scheduleState[i]=
"Done";

addLog(
"Scheduled");

updateUI();

},4000);


});

}

});

},1000);







// ================= FEED =================

function feed(){

if(isFeeding)
return;


isFeeding=true;


let btn=
document.getElementById(
"feedBtn");



btn.innerText=
"Feeding...";


btn.classList.add(
"feedingBtn");



firebase.database()

.ref("feedNow")

.set(1)

.then(()=>{


// WAIT SERVO

setTimeout(()=>{


btn.innerText=
"Done ✅";


btn.classList.remove(
"feedingBtn");

btn.classList.add(
"doneBtn");



addLog(
"Manual");



setTimeout(()=>{

btn.innerText=
"🍽 Feed Now";

btn.classList.remove(
"doneBtn");

isFeeding=false;

},3000);



},4000);



})

.catch(()=>{

btn.innerText=
"Failed ❌";


setTimeout(()=>{

btn.innerText=
"🍽 Feed Now";

isFeeding=false;

},3000);

});

}



document

.getElementById(
"feedBtn")

.addEventListener(
"click",

feed);






// ================= LOGS =================

function addLog(type){

const now=
new Date();


feedHistory.push({

type,

date:
now.toLocaleDateString(),

time:
now.toLocaleTimeString([],{

hour:"2-digit",

minute:"2-digit"

})

});


updateFeedTable();

updateLastFed();

}




function updateFeedTable(){

let table=
document.getElementById(
"feedTable");

table.innerHTML="";


feedHistory

.slice()

.reverse()

.forEach(item=>{

table.innerHTML+=`

<tr>

<td>

${item.type}

</td>

<td>

${item.date}

</td>

<td>

${item.time}

</td>

</tr>

`;

});

}




// ================= LAST FED =================

function updateLastFed(){

let el=
document.getElementById(
"lastFed");

if(
feedHistory.length==0
){

el.innerHTML=
"<tr><td colspan='3'>No data</td></tr>";

return;

}


let last=
feedHistory[
feedHistory.length-1
];


el.innerHTML=

`

<tr>

<td>

${last.type}

</td>

<td>

${last.date}

</td>

<td>

${last.time}

</td>

</tr>

`;

}





// ================= STATUS =================

function updateUI(){

["status1",
"status2",
"status3"]

.forEach((id,i)=>{

let el=
document.getElementById(
id);

let state=
scheduleState[i];

el.innerText=
state;


if(
state=="Pending"
)

el.style.background=
"#f39c12";


if(
state=="Scheduled"
)

el.style.background=
"#2f7a4f";


if(
state=="Done"
)

el.style.background=
"#2196F3";

});

}




// LOAD SCHEDULE

firebase.database()

.ref("schedule")

.on(

"value",

(snapshot)=>{

let data=
snapshot.val();

if(!data)
return;


time1.value=
data.time1||"";

time2.value=
data.time2||"";

time3.value=
data.time3||"";

});