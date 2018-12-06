'use strict';

// url stash



// application dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

const app = express();

app.use(cors());


// get application constants
require('dotenv').config();
const PORT = process.env.PORT;

// DATABASE CONFIG
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

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
app.get(('/location'), getLatLng);

// HELPER, LOCATION: define cache handling
function getLatLng (request, response) {
  const handler = {
    query: request.query.data,
    cacheHit: (results) => {
      response.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLatLng(request.query.data)
        .then( results => response.send(results));
    }
  };
  checkDB(handler);
}

// HELPER, LOCATION: db lookup, hit/miss call
function checkDB (handler) { // same as 'lookupLocation' in B's code
// query cache
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query( SQL, values)
    .then( results => {
      console.log('query results: ', results);
      // if results, then return results to hit
      if (results.rowCount > 0) {
        handler.cacheHit(results);
        // if no results, then point to miss
      } else {
        handler.cacheMiss();
      }
    })
    // if bad query, then point to error handler
    .catch( error => handleError(error) );
}

// HELPER, LOCATION: constructor
function Location (data, query) {
  this.search_query = query,
  this.formatted_query = data.formatted_address,
  this.latitude = data.geometry.location.lat,
  this.longitude = data.geometry.location.lng
}

// HELPER, LOCATION: fetch location from API
Location.fetchLatLng = (query) => {
  // API call
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(url)
    .then( apiData => {
      // if no data: throw error
      if (!apiData.body.results.length) {
        throw 'No Data from API'
        // if data: save, send to front
      } else {
        let location = new Location (apiData.body.results[0], query);
        return location.saveToDB()
          .then( result => {
            location.id = result.rows[0].id;
            return location;
          })
          // return location;
      }
    })
}

//HELPER, SAVE: save API data to DB
Location.prototype.saveToDB = function() {
  const SQL = `
    INSERT INTO locations
      (search_query,formatted_query,latitude,longitude)
      VALUES($1,$2,$3,$4)
      RETURNING id
  `;
  let values = Object.values(this);
  return client.query( SQL,values );
};





// // set WEATHER route
// app.get(('/weather'), getWeather)

// // HELPER: get weather data and return location object
// function getWeather (request, response) {
//   const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

//   superagent.get(url)
//     .then( weatherResult => {
//       const weather = weatherResult.body.daily.data.map( (day,index) => {
//         return new Weather(day);
//       })
//       response.send(weather);
//     })
//     .catch(error => handleError(error));

// }

// // HELPER: Weather constructor
// function Weather(weatData) {
//   this.forecast = weatData.summary;
//   this.time = new Date(weatData.time * 1000).toDateString();
// }

// // set YELP route
// app.get(('/yelp'), getRestaurants)
  
// // HELPER: get restaurants data
// function getRestaurants(request,response) {
//   const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
//   superagent.get(url)
//     .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then( yelpDataRaw => {
//       const restaurants = yelpDataRaw.body.businesses.map(thisOne => {
//         return new Restaurant(thisOne);
//       });
//       response.send(restaurants);
//     })
//     .catch(error => handleError(error));
// }

// // HELPER: Restaurant constructor
// function Restaurant (restaurant) {
//   this.name = restaurant.name,
//   this.image_url = restaurant.image_url,
//   this.price = restaurant.price,
//   this.rating = restaurant.rating,
//   this.url = restaurant.url
// }

// // set MOVIES route
// app.get(('/movies'), getMovies)

// // HELPER: get movies data
// function getMovies(request, response) {
//   const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${request.query.data.search_query}`;
//   superagent.get(url)
//     .then( movieData => {
//       let parsedData = JSON.parse(movieData.text);
//       let allMovies = parsedData.results.map( rawMovie => {
//         let thisMovie = new Movie (rawMovie);
//         return thisMovie;
//       } );
//       response.send(allMovies);
//     } )
//     .catch(error => handleError(error));
// }

// // HELPER: Movie constructor
// function Movie (data) {
//   this.title = data.title,
//   this.overview = data.overview,
//   this.average_votes = data.vote_average,
//   this.total_votes = data.vote_count,
//   this.image_url = `https://image.tmdb.org/t/p/w200_and_h300_bestv2/${data.poster_path}`,
//   this.popularity = data.popularity,
//   this.released_on = data.release_date
// }


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
