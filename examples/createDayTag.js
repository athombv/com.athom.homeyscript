const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
await setTagValue("dayofweek", {type: "string", title: "DayOfWeek"}, DAYS[new Date().getDay()]);
return true;
