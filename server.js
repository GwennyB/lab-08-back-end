'use strict';

// application dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

const app = express();

app.use(cors());

// get application constants
require('dotenv').config();
const PORT = process.env.PORT || 4000;

// set test route
// app.get('/test', (request,response) => {
//   response.send('TEST success');
// })

// establish public directory
app.use(express.static('./city-explorer-client'));

// set home route
app.get((''), (request,response) => {
  response.send(`${__dirname}/city-explorer-client/index.html`);
})

// set LOCATION route
app.get(('/location'), (request, response) => {
  getLatLng(request.query.data)
    .then (location => {
      response.send(location)
    });
})

// HELPER: get location data and return location object
function getLatLng (query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=seattle&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(url)
    .then(locResult => new Location(locResult.body, query) )
    .catch(error => handleError(error));
}

// HELPER: Location constructor
function Location (data, query) {
  this.search_query = query,
  this.formatted_query = data.results[0].formatted_address,
  this.latitude = data.results[0].geometry.location.lat,
  this.longitude = data.results[0].geometry.location.lng
}

// set WEATHER route
app.get(('/weather'), getWeather)

// HELPER: get weather data and return location object
function getWeather (request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

  superagent.get(url)
    .then( weatherResult => {
      const weather = weatherResult.body.daily.data.map( (day,index) => {
        return new Weather(day);
      })
      response.send(weather);
    })
    .catch(error => handleError(error));

}

// HELPER: Weather constructor
function Weather(weatData) {
  this.forecast = weatData.summary;
  this.time = new Date(weatData.time * 1000).toDateString();
}

// set YELP route
app.get(('/yelp'), getRestaurants)
  
// HELPER: get restaurants data
function getRestaurants(request,response) {
  const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
  superagent.get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then( yelpDataRaw => {
      const restaurants = yelpDataRaw.body.businesses.map(thisOne => {
        return new Restaurant(thisOne);
      });
      response.send(restaurants);
    })
    .catch(error => handleError(error));
}

// HELPER: Restaurant constructor
function Restaurant (restaurant) {
  this.name = restaurant.name,
  this.image_url = restaurant.image_url,
  this.price = restaurant.price,
  this.rating = restaurant.rating,
  this.url = restaurant.url
}

// set MOVIES route
app.get(('/movies'), getMovies)

// HELPER: get movies data
function getMovies(request, response) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${request.query.data.search_query}`;
  superagent.get(url)
    .then( movieData => {
      let parsedData = JSON.parse(movieData.text);
      let allMovies = parsedData.results.map( rawMovie => {
        let thisMovie = new Movie (rawMovie);
        return thisMovie;
      } );
      response.send(allMovies);
    } )
    .catch(error => handleError(error));
}

// HELPER: Movie constructor
function Movie (data) {
  this.title = data.title,
  this.overview = data.overview,
  this.average_votes = data.vote_average,
  this.total_votes = data.vote_count,
  this.image_url = `https://image.tmdb.org/t/p/w200_and_h300_bestv2/${data.poster_path}`,
  this.popularity = data.popularity,
  this.released_on = data.release_date
}


// // set MEETUP route
// app.get(('/meetup'), getMeetups)

// // HELPER: get meetup data
// function getMeetups(request, response) {
//   const url = ``
//   superagent.get(url)
//     .then()
//     .catch()
// }

// // HELPER: Trail constructor
// function Trail (data) {
//   // assign properties here
// }



// // set TRAILS route
// app.get(('/trails'), getTrails)

// // HELPER: get trails data
// function getTrails(request, response) {
//   const url = ``
//   superagent.get(url)
//     .then()
//     .catch()
// }

// // HELPER: Trail constructor
// function Trail (data) {
//   // assign properties here
// }



// error handler
function handleError (error, response) {
  // console.error(error);
  if(response) response.status(500).send('Sorry, something went wrong.');
}


// open port
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
})
