//const { v4: uuidv4 } = require("uuid");
import moment from "moment";
import { randomInt } from "crypto";
// * config files
//const dbPool = require("../config/dbPool");
//const constEnum = require("../constant/enum");


const listOfYears = function(){
  var max = moment().utc().year();
  var min = max - 100;
  var years = [];

  for (var i = max; i >= min; i--) {
    years.push(i);
  }
  return years;
};

const diffTwoDateTime = function(newTime, oldTime)
{
  newTime = moment(newTime);
  oldTime = moment(oldTime);
  var duration = moment.duration(newTime.diff(oldTime));

  var days = duration._data.days;
  var hours = duration._data.hours;
  var minutes = duration._data.minutes;
  var months = duration._data.months;

  return {
    days: days,
    hours: hours,
    minutes: minutes,
    months: months,
  };
};

const convertToDateTime = function(value){
  let result = moment(value).format("DD-MM-YYYY HH:mm:ss");
  return result;
};

const convertToDate = function(value){
  let result = moment(value).format("DD-MM-YYYY");
  return result;
};

const randomNumber = function(){
  var a = Math.floor(100000 + Math.random() * 900000);
  a = String(a);
  a = a.substring(0, 4);
  return a;
};

const generateRandomString = function (length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
      result += characters.charAt(randomInt(charactersLength));
  }
  return result;
}


const overduedays = function(receivedDate){
  try{

      if(receivedDate == null || receivedDate == undefined){
        return 0;
      }
      const startDate = new Date(receivedDate)
      const endDate = new Date()

      if(startDate > endDate){
        return 0;
      }

      let count =0
      let current = new Date(receivedDate)

      while(current <= endDate){
        const day = current.getDay()
        if(day >= 1 && day <= 5){
          count++;
        }
        current.setDate(current.getDate()+1)
      }
      return count;

  }catch(error){
    
  }
}




export {
  listOfYears, 
  diffTwoDateTime,
  convertToDateTime,
  convertToDate,
  randomNumber, 
  generateRandomString,
  overduedays
}
