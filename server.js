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
app.get(('/weather'), getFeature);
app.get(('/yelp'), getFeature);
app.get(('/movies'), getFeature)


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
Location.lookupLocation = (handler) { 
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
          // return location;
      }
    })
};

// HELPER, SAVE: save API data to DB
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
function getFeature (request, response) {
  const handler = {
    query: request.query.data,
    cacheHit: (results) => {
      response.send(results.rows);
    },
    cacheMiss: () => {
      Weather.fetch(request.query.data)
        .then( results => response.send(results))
        .catch( error => handleError(error));
    }
  };
  lookupFeature(handler);
}

function lookupFeature (handler, tableName, id) {
  // query cache
  const SQL = `SELECT * FROM ${tableName} WHERE id=${id}`;
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
};



// HELPERS, WEATHER
function Weather(weatData) {
  this.forecast = weatData.summary;
  this.time = new Date(weatData.time * 1000).toDateString();
}

Weather.fetch = (query) => {
  // API call
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;
  return superagent.get(url)
    .then( apiData => {
      // if no data: throw error
      if (!apiData.body.daily.length) {
        throw 'No Data from API'
        // if data: save, send to front
      } else {
        const weather = apiData.body.daily.data.map( (day) => {
          const thisWeather = new Weather(day);
          thisWeather.save(query.id);
          return thisWeather;
        })
      return weather;
      }
    });
};

Weather.prototype.saveToDB = function() {
  const SQL = `
  INSERT INTO weathers
    (forecast,time)
    VALUES($1,$2)
    RETURNING id
`;
let values = Object.values(this);
return client.query( SQL,values );
};


// HELPERS, YELP
function Restaurant (restaurant) {
  this.name = restaurant.name,
  this.image_url = restaurant.image_url,
  this.price = restaurant.price,
  this.rating = restaurant.rating,
  this.url = restaurant.url
}

Restaurant.fetchYelp = (query) => {
  const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
  return superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then( apiData => {
      // if no data: throw error
      if (!apiData.body.daily.length) {
        throw 'No Data from API'
        // if data: save, send to front
      } else {
        const restaurants = apiData.body.businesses.map(thisOne => {
          const thisRestaurant = new Restaurant(thisOne);
          thisRestaurant.save(query.id);
          return thisRestaurant;
        })
      return restaurants;
      }
    });
};

Restaurant.prototype.saveToDB = function() {
  const SQL = `
    INSERT INTO yelps
      (name,image_url,price,rating,url)
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
  `;
  let values = Object.values(this);
  return client.query( SQL,values );
};


// HELPERS, MOVIES
function Movie (data) {
  this.title = data.title,
  this.overview = data.overview,
  this.average_votes = data.vote_average,
  this.total_votes = data.vote_count,
  this.image_url = `https://image.tmdb.org/t/p/w200_and_h300_bestv2/${data.poster_path}`,
  this.popularity = data.popularity,
  this.released_on = data.release_date
}

Movie.fetchMovies = (query) => {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${request.query.data.search_query}`;
  return superagent.get(url)
    .then( apiData => {
      // if no data: throw error
      if (!apiData.body.daily.length) {
        throw 'No Data from API'
        // if data: save, send to front
      } else {
        let parsedData = JSON.parse(apiData.text);
        let allMovies = parsedData.results.map( rawMovie => {
          let thisMovie = new Movie (rawMovie);
          return thisMovie;
        });
      }
      return allMovies;
    })
};

Movie.prototype.saveToDB = function() {
  const SQL = `
  INSERT INTO movies
    (title,overview,average_votes,total_votes,image_url,popularity,released_on)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING id
  `;
  let values = Object.values(this);
  return client.query( SQL,values );
};







// error handler
function handleError (error, response) {
  // console.error(error);
  if(response) response.status(500).send('Sorry, something went wrong.');
}


// open port
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
})
