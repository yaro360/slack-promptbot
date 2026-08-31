const { schedule } = require('../config/competitors');

function getNextRunTime() {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  const target = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone }));
  target.setHours(hours, minutes, 0, 0);
  
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}

function msUntilNextRun() {
  const now = new Date();
  const nyNow = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone }));
  
  const [targetHours, targetMinutes] = schedule.time.split(':').map(Number);
  
  const target = new Date(nyNow);
  target.setHours(targetHours, targetMinutes, 0, 0);
  
  if (target <= nyNow) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - nyNow.getTime();
}

function startDailyScheduler(callback) {
  const runDaily = async () => {
    try {
      console.log(`[${new Date().toISOString()}] Running scheduled competitive intelligence digest...`);
      await callback();
    } catch (err) {
      console.error('Scheduler error:', err);
    }
    
    const msToNext = msUntilNextRun();
    console.log(`Next run scheduled in ${Math.round(msToNext / 1000 / 60)} minutes`);
    setTimeout(runDaily, msToNext);
  };
  
  const msToFirst = msUntilNextRun();
  console.log(`Competitive Intelligence scheduler started.`);
  console.log(`First digest scheduled for ${schedule.time} ${schedule.timezone} (in ${Math.round(msToFirst / 1000 / 60)} minutes)`);
  console.log(`Channel: #${schedule.channel}`);
  
  setTimeout(runDaily, msToFirst);
  
  return {
    nextRun: getNextRunTime(),
    channel: schedule.channel,
    timezone: schedule.timezone
  };
}

function runImmediately(callback) {
  return callback();
}

module.exports = {
  startDailyScheduler,
  runImmediately,
  getNextRunTime,
  msUntilNextRun
};
