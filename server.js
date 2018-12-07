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

// set routes
app.get(('/location'), getLatLng);
app.get(('/weather'), getWeather);
// app.get(('/yelp'), getYelp);
// app.get(('/movies'), getMovies);


// HELPER, LOCATION: define cache handling
function getLatLng (request, response) {
  const handler = {
    query: request.query.data,
    cacheHit: (results) => {
      response.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetch(request.query.data)
        .then( results => response.send(results));
    }
  };
  Location.lookupLocation(handler);
}

// HELPER, LOCATION: db lookup, hit/miss call
Location.lookupLocation = (handler) => { 
// query cache
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query( SQL, values)
    .then( results => {
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
};

// HELPER, LOCATION: constructor
function Location (data, query) {
  this.search_query = query,
  this.formatted_query = data.formatted_address,
  this.latitude = data.geometry.location.lat,
  this.longitude = data.geometry.location.lng
}

// HELPER, LOCATION: fetch location from API
Location.fetch = (query) => {
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
      }
    })
};

// HELPER, LOCATION: save API data to DB
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


// GENERIC HELPERS
function Feature (request) {
  this.location_id = request.query.data.id || 0;
  this.query = request.query.data;
}


Feature.prototype.lookupFeature = function () {
  // query cache
  const SQL = `SELECT * FROM ${this.tableName} WHERE location_id=$1`;
  const values = [this.location_id];
  return client.query( SQL, values)
    .then( results => {
      // if results, then return results to hit
      if (results.rowCount > 0) {
        // if no results, then point to miss
      } else {
        this.cacheMiss();
      }
    })
    // if bad query, then point to error handler
    .catch( error => handleError(error) );
}


// HELPERS, WEATHER
function getWeather (request, response) {
  const handler = new Feature (request);
  handler.cacheHit = (results) => {
    response.send(results.rows);
  }
  handler.cacheMiss = () => {
    Weather.fetch(request.query)
      .then( results => response.send(results))
      .catch( error => handleError(error));
  }
  handler.tableName = 'weathers',
  handler.lookupFeature();
}

function Weather(weatData, locID) {
  this.location_id = locID;
  this.forecast = weatData.summary;
  this.time = new Date(weatData.time * 1000).toDateString();
}

Weather.fetch = function(query) {
  // API call
  const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${query.data.latitude},${query.data.longitude}`;
  return superagent.get(url)
    .then( apiData => {
      // if no data: throw error
      if (!apiData.body.daily.data.length) {
        throw 'No Data from API'
        // if data: save, send to front
      } else {
        const weather = apiData.body.daily.data.map( day => {
          const thisWeather = new Weather(day, query.data.id);
          thisWeather.saveToDB();
          return thisWeather;
        })
        return weather;
      }
    });
};

Weather.prototype.saveToDB = function() {
  const SQL = `INSERT INTO weathers (forecast,time,location_id) VALUES ($1,$2,$3)`;
  let values = [this.forecast,this.time,this.location_id];
  let weather = client.query( SQL,values );
  return weather;
};


// HELPERS, YELP
// function getYelp (request, response) {
//   const handler = {
//     id: request.query.data.id || 0,
//     query: request.query.data,
//     cacheHit: (results) => {
//       response.send(results.rows);
//       console.log('Yelp cacheHit: ', results);
//     },
//     cacheMiss: () => {
//       Yelp.fetch(request.query.data)
//         .then( results => response.send(results))
//         .catch( error => handleError(error));
//     },
//     tableName: 'yelps',
//   };
//   lookupFeature(handler);
// }

// function Yelp (data) {
//   this.name = data.name,
//   this.image_url = data.image_url,
//   this.price = data.price,
//   this.rating = data.rating,
//   this.url = data.url
// }

// Yelp.fetch = (query) => {
//   const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
//   return superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then( apiData => {
//       // if no data: throw error
//       if (!apiData.body.daily.length) {
//         throw 'No Data from API'
//         // if data: save, send to front
//       } else {
//         const yelps = apiData.body.businesses.map(thisOne => {
//           const thisYelp = new Yelp(thisOne);
//           thisYelp.save(query.id);
//           return thisYelp;
//         })
//         return yelps;
//       }
//     });
// };

// Yelp.prototype.saveToDB = function() {
//   const SQL = `
//     INSERT INTO yelps
//       (name,image_url,price,rating,url)
//       VALUES($1,$2,$3,$4,$5)
//       RETURNING id
//   `;
//   let values = Object.values(this);
//   return client.query( SQL,values );
// };


// // HELPERS, MOVIES
// function getMovies (request, response) {
//   console.log('Movies request: ', request.query);
//   const handler = {
//     id: request.query.data.id || 0,
//     query: request.query.data,
//     cacheHit: (results) => {
//       response.send(results.rows);
//       console.log('Movie cacheHit: ', results);
//     },
//     cacheMiss: () => {
//       Movie.fetch(request.query.data)
//         .then( results => response.send(results))
//         .catch( error => handleError(error));
//     },
//     tableName: 'movies',
//   };
//   lookupFeature(handler);
// }

// function Movie (data) {
//   this.title = data.title,
//   this.overview = data.overview,
//   this.average_votes = data.vote_average,
//   this.total_votes = data.vote_count,
//   this.image_url = `https://image.tmdb.org/t/p/w200_and_h300_bestv2/${data.poster_path}`,
//   this.popularity = data.popularity,
//   this.released_on = data.release_date
// }

// Movie.fetch = (query) => {
//   const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${request.query.data.search_query}`;
//   return superagent.get(url)
//     .then( apiData => {
//       // if no data: throw error
//       if (!apiData.body.daily.length) {
//         throw 'No Data from API'
//         // if data: save, send to front
//       } else {
//         let parsedData = JSON.parse(apiData.text);
//         let allMovies = parsedData.results.map( rawMovie => {
//           let thisMovie = new Movie (rawMovie);
//           return thisMovie;
//         });
//       }
//       return allMovies;
//     })
// };

// // Movie.prototype.saveToDB = function() {
//   const SQL = `
//   INSERT INTO movies
//     (title,overview,average_votes,total_votes,image_url,popularity,released_on)
//     VALUES($1,$2,$3,$4,$5,$6,$7)
//     RETURNING id
//   `;
//   let values = Object.values(this);
//   return client.query( SQL,values );
// };







// error handler
function handleError (error, response) {
  // console.error(error);
  if(response) response.status(500).send('Sorry, something went wrong.');
}


// open port
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
})
