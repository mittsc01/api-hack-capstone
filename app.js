//const markers=[];
//TODO: handle clicks on water and far northern/southern areas.
const infoWindows=[];
function initMap() {
  
  
  const myLatLng = { lat: 45, lng: -95 };
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 5,
    center: myLatLng,
  });
  
  //This is the 'landing' message
  const contentString=
  `<h1>Sun App</h1>
  <p>
  Welcome to the Sun app! Click anywhere to get info about sunrise and sunset.
    If you click on a body of water, you likely won't get the local sunrise/sunset times, but you will get the
     time until sunrise/sunset. Sunrise and sunset data come from <a target="_blank "href="https://sunrise-sunset.org/">sunrise-sunset.org<a>.
     All times are local 24 hour times.
     </p>
  
  `
  const infowindow = new google.maps.InfoWindow({content:contentString, position:myLatLng});
  infoWindows.push(infowindow)
  infowindow.open(map)
  

  google.maps.event.addListener(map, 'click', function (event) {
    placeMarker(event.latLng);
    
  });
  function placeMarker(location) {
    
    var infowindow = new google.maps.InfoWindow();
    var marker = new google.maps.Marker({
      position: location,
      map: map
    });
    marker.addListener("click", () => {
      //close all infoWindows and open the infoWindow at the marker that was just clicked
      infoWindows.forEach(window=>window.close())
      infowindow.open(map, marker);
      
    });
    
    
    infoWindows.push(infowindow)

    
    retrieveSunset(marker)
    
    

  }
  
}

  





function retrieveSunset(marker) {
  
  
  const currentDate = new Date().getTime();
  //urls for retrieving sunrise and sunset times for the given location
  const sunRiseSetBaseUrl='https://api.sunrise-sunset.org/json?';
  const sunRiseSetKeys = {
    lat:marker.position.lat(),
    lng:marker.position.lng(),
    formatted:0
  }
  const urlYesterday = sunRiseSetBaseUrl+`lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=yesterday`
  const urlToday = sunRiseSetBaseUrl+`lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=today`
  const urlTomorrow = sunRiseSetBaseUrl+`lat=${marker.position.lat()}&lng=${marker.position.lng()}&formatted=0&date=tomorrow`

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
    
    //These variables are used only for cases where (dayLength) user clicks at  a location where sun is up/down all day
    // or (timeZoneAvailable) where local time is unavailable (e.g. middle of the ocean)
    const dayLength=Math.min(data[0].results['day_length'],data[1].results['day_length'],data[2].results['day_length']);
    const timeZoneAvailable = data[3].status!=='ZERO_RESULTS'
    

    
    
    

    //convert sunrise/sunset times to milliseconds since Jan 1 1970
    for (let i = 0; i < sunRiseSetArray.length; i++) {
      sunRiseSetArray[i] = new Date(sunRiseSetArray[i]).getTime()
    }
    
    const period = periodOfDay(sunRiseSetArray, currentDate)

    const sunRiseSetObject = computeSunriseAndSunset(period, sunRiseSetArray,dayLength,timeZoneAvailable)
    

    const localizedObject = translateTimesToLocal(sunRiseSetObject, offset)

    const printReadyObject = makeTimesReadable(localizedObject)


    

    //close open infowindow and open an infowindow at the marker just placed
    infoWindows.forEach(window=>window.close())
    infoWindows[infoWindows.length-1].setContent(generateHtmlString(printReadyObject))
    infoWindows[infoWindows.length-1].open(map,marker)
    

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
function computeSunriseAndSunset(period, sunRiseSetArray,dayLength,timeZoneAvailable) {
  if (period % 2 === 0) {
    return {
      sunrise: sunRiseSetArray[period],
      sunset: sunRiseSetArray[period - 1],
      sundown: true,
      timeSinceEvent: new Date().getTime() - sunRiseSetArray[period - 1],
      timeBeforeEvent: sunRiseSetArray[period] - new Date().getTime(),
      dayLength:dayLength,
      timeZoneAvailable:timeZoneAvailable
    }
  }
  else {
    return {
      sunrise: sunRiseSetArray[period - 1],
      sunset: sunRiseSetArray[period],
      sundown: false,
      timeSinceEvent: new Date().getTime() - sunRiseSetArray[period - 1],
      timeBeforeEvent: sunRiseSetArray[period] - new Date().getTime(),
      dayLength:dayLength,
      timeZoneAvailable:timeZoneAvailable
    }
  }
}
//generates string to be rendered
function generateHtmlString(sunRiseSetObject) {
  //sun up all day or down all day (sunrise/sunset api returns day_length=0 in either case)
  if (sunRiseSetObject.dayLength===0){
    return `<div class="info-window">
    <p>We are unable to obtain sunset/sunrise data at this latitude because either (a) the sun is up all day or (b) the sun is down all day.</p>
    </div>`
  }
  //user clicks on area where google Time Zone API usually doesn't return data (e.g. middle of the ocean)
  else if (!sunRiseSetObject.timeZoneAvailable){
    if (sunRiseSetObject.sundown) {
      return `<div class="info-window sundown">
      <img src="./icons8-moon-symbol-50.png" alt="sun is currently down" />
      <p>Currently the sun is down. ${sunRiseSetObject.timeSinceEvent} since sunset. ${sunRiseSetObject.timeBeforeEvent} until sunrise.</p>
      </div>`
    }
    else {
      return `<div class="info-window sun-up">
    <img src="./icons8-sun-50.png" alt="sun is currently up" />
    <p>Currently the sun is up. ${sunRiseSetObject.timeSinceEvent} since sunrise. ${sunRiseSetObject.timeBeforeEvent} until sunset</p>
    </div>`
    }
  }
  //user clicks on area where sun is currently down
  else if (sunRiseSetObject.sundown) {
    return `<div class="info-window sundown">
    <img src="./icons8-moon-symbol-50.png" alt="sun is currently down" />
    <p>Currently the sun is down. Sunrise is at ${sunRiseSetObject.sunrise}. ${sunRiseSetObject.timeSinceEvent} since sunset. ${sunRiseSetObject.timeBeforeEvent} until sunrise.</p>
    </div>`
  }
  //user clicks on area where sun is currently up
  else {
    return `<div class="info-window sun-up">
    <img src="./icons8-sun-50.png" alt="sun is currently up" />
    <p>Currently the sun is up. Sunset is at ${sunRiseSetObject.sunset}. ${sunRiseSetObject.timeSinceEvent} since sunrise. ${sunRiseSetObject.timeBeforeEvent} until sunset</p>
    </div>`
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







