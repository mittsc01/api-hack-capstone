function initMap() {

  const ptList = [];
  const myLatLng = { lat: 0, lng: 0 };
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 2.5,
    center: myLatLng,
  });


  google.maps.event.addListener(map, 'click', function (event) {
    placeMarker(event.latLng);
  });

  function placeMarker(location) {
    var marker = new google.maps.Marker({
      position: location,
      map: map
    });


    retrieveSunset(marker)

  }



}

function retrieveSunset(marker) {
  const currentDate = new Date().getTime();
  //urls for retrieving sunrise and sunset times for the given location
  const urlYesterday = `https://api.sunrise-sunset.org/json?lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=yesterday`
  const urlToday = `https://api.sunrise-sunset.org/json?lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=today`
  const urlTomorrow = `https://api.sunrise-sunset.org/json?lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=tomorrow`

  //url for time zone/dst offset
  const urlTimeZone = `https://maps.googleapis.com/maps/api/timezone/json?location=${marker.position.lat()},${marker.position.lng()}&timestamp=${Math.floor(currentDate / 1000)}&key=AIzaSyADZsPrXORmQTRUvCU-pMqSGlHW7iN6Ra0
    `
  Promise.all([
    fetch(urlYesterday),
    fetch(urlToday),
    fetch(urlTomorrow),
    fetch(urlTimeZone)
  ]).then(function (responses) {
    // Get a JSON object from each of the responses
    return Promise.all(responses.map(function (response) {
      return response.json();
    }));
  }).then(function (data) {
    //console.log(data[1].timeZoneName)
    //array containing sunrise/sunset times for yesterday, today and tomorrow ordered sequentially
    const sunRiseSetArray = [
      data[0].results.sunrise,
      data[0].results.sunset,
      data[1].results.sunrise,
      data[1].results.sunset,
      data[2].results.sunrise,
      data[2].results.sunset
    ]
    //this is the number of milliseconds of offset from UTC based on timezone and daylight savings
    const offset = 1000 * (data[3].rawOffset + data[3].dstOffset);

    //convert sunrise/sunset times to milliseconds since Jan 1 1970
    for (let i = 0; i < sunRiseSetArray.length; i++) {
      sunRiseSetArray[i] = new Date(sunRiseSetArray[i]).getTime()
    }

    const period = periodOfDay(sunRiseSetArray, currentDate)

    const sunRiseSetObject = computeSunriseAndSunset(period, sunRiseSetArray)

    const localizedObject = translateTimesToLocal(sunRiseSetObject, offset)

    const printReadyObject = makeTimesReadable(localizedObject)


    //should use a render function here
    document.getElementById('sunset-display').innerHTML = generateHtmlString(printReadyObject)

  }).catch(function (error) {
    // if there's an error, log it
    console.log(error);
  });
}





// returns index of maximum item of array for which currentTime is earlier than
// we use this to select which sunrise and sunset (e.g. yesterday, today, tomrorrow)
// are most proximate
function periodOfDay(arr, currentTime) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > currentTime) {
      return i
    }
  }


}
//returns object with most proximate sunrise and sunset
function computeSunriseAndSunset(period, sunRiseSetArray) {
  if (period % 2 === 0) {
    return {
      sunrise: sunRiseSetArray[period],
      sunset: sunRiseSetArray[period - 1],
      sundown: true,
      timeSinceEvent: new Date().getTime() - sunRiseSetArray[period - 1],
      timeBeforeEvent: sunRiseSetArray[period] - new Date().getTime()
    }
  }
  else {
    return {
      sunrise: sunRiseSetArray[period - 1],
      sunset: sunRiseSetArray[period],
      sundown: false,
      timeSinceEvent: new Date().getTime() - sunRiseSetArray[period - 1],
      timeBeforeEvent: sunRiseSetArray[period] - new Date().getTime()

    }
  }
}
//generates string to be rendered
function generateHtmlString(sunRiseSetObject) {
  if (sunRiseSetObject.sundown) {
    return `<h2>Currently the sun is down. Sunrise is at ${sunRiseSetObject.sunrise}. ${sunRiseSetObject.timeSinceEvent} since sunset. ${sunRiseSetObject.timeBeforeEvent} until sunrise.</h2>`
  }
  else {
    return `<h2>Currently the sun is up. Sunset is at ${sunRiseSetObject.sunset}. ${sunRiseSetObject.timeSinceEvent} since sunrise. ${sunRiseSetObject.timeBeforeEvent} until sunset</h2>`
  }
}

function translateTimesToLocal(sunRiseSetObject, offset) {
  sunRiseSetObject.sunrise += offset;
  sunRiseSetObject.sunset += offset;
  return sunRiseSetObject
}
//converts local sunrise/sunset times from milliseconds 
//since Jan 1 1970 to hh:mm format (24 hr)
function makeTimesReadable(sunRiseSetObject) {
  const sunrise = new Date(sunRiseSetObject.sunrise)
  const sunset = new Date(sunRiseSetObject.sunset)
  const timeSince = sunRiseSetObject.timeSinceEvent
  const timeBefore = sunRiseSetObject.timeBeforeEvent
  sunRiseSetObject.sunset = `${sunset.getUTCHours()}:${addLeadingZero(sunset.getUTCMinutes())}`;
  sunRiseSetObject.sunrise = `${sunrise.getUTCHours()}:${addLeadingZero(sunrise.getUTCMinutes())}`;
  sunRiseSetObject.timeSinceEvent = `${Math.floor(timeSince / 3600000)} hrs and ${Math.floor((timeSince % 3600000) / 60000)} minutes`
  sunRiseSetObject.timeBeforeEvent = `${Math.floor(timeBefore / 3600000)} hrs and ${Math.floor((timeBefore % 3600000) / 60000)} minutes`
  return sunRiseSetObject
}

//ensure hh:mm format if minutes<10
function addLeadingZero(minutes){
  if (minutes<10){
    return "0"+`${minutes}`
  }
  return minutes
}





