'use strict';
const Restify = require('restify');
const { dialogflow } = require('actions-on-google');
const server = Restify.createServer({
  name: "bankonme"
});
const fs = require('fs');
const request = require('request');
const PORT = process.env.PORT || 3000;

server.use(Restify.bodyParser());
server.use(Restify.jsonp());



const convertCurrency = (amountToConvert, outputCurrency, cb) => {
  const {amount, currency} = amountToConvert;
  return request({
    url: "https://free.currencyconverterapi.com/api/v6/convert",
    qs: {
      q: `${currency}_${outputCurrency}`,
      compact: 'y'
    },
    method: 'GET',
    json: true
  }, (error, response, body) => {
    if(!error && response.statusCode === 200) {
      let computedValue = Math.round(body[`${currency}_${outputCurrency}`]['val'] * amount);
      cb(null, `${amount} ${currency} converts to about ${outputCurrency} ${computedValue} as per current rates!`);
    } else {
      cb(error, null);
    }
  });

}


const getInterestRate = (period, unit, cb) => {
  
    var period_in_days = 0;
    switch(unit){
      case 'day':
        period_in_days = period;  
        break;
      case 'mo':
        period_in_days = period * 30;
        break;
      case 'yr':
        period_in_days = period * 365;
        break;
      default:
        cb(null, `Please enter the Fixed Deposit term/duration in days, months or years`);
        break;
      }
    
    fs.readFile( __dirname + "/" + "interest_rates.json", 'utf8', function (err, data) {
      
      if (err) {
        console.log("error" + err.code);
      } else {
        console.log("i am doing just fine");
      }
      
      var rates = JSON.parse( data );
      var interest_rate = 0;
      
      var count = Object.keys(rates).length;
      const rates_array = Object.keys(rates);
      
      for(var i = 0; i < count; i++) {
      
        if (period_in_days <= rates_array[i]) {
          interest_rate = rates[rates_array[i]].interest_rate;
          break;
        }
              
      }
      if (interest_rate == 0){
        cb(null, `For a period of ${period} ${unit}, the rate of interest is not available`);  
      } else {
        cb(null, `For a period of ${period} ${unit}, the rate of interest is ${interest_rate}`);
      }
   });
}


// POST route handler
server.post('/', (req, res, next) => {
  //const app = new DialogflowApp({request:req, response:res}); 
  
  let {queryResult} = req.body;

  console.log(queryResult);
  
  //Check the intent
  
  
  
  if(queryResult) {
    console.log(queryResult.action);
  
    //Action is input.welcome
    if (queryResult.action === 'input.welcome') {
      let result = `Hello, How can I help you?`;
      let respObj = {
            fulfillmentText: result,
            "payload": {
              "google": {
                "expectUserResponse": true,
                "richResponse": {
                  "items": [
                    {
                      "simpleResponse": {
                        "textToSpeech": "Hello, How can I help you?"
                      }
                    }
                  ],
                  "suggestions": [
                    {
                      "title": "Interest Rate Query"
                    },
                    {
                      "title": "Currency Conversion"
                    },
                    {
                      "title": "Nearby ATM or branch"
                    }
                  ]
                }
              }
            }
      }
      res.json(respObj);
    }
    
    //Action is to check nearby branch or ATM.
    //In such case, it is required to first obtain user permission to get
    // his/her location
    if (queryResult.action === 'requestPermission') {
      
      //let result = `Hello, How can I help you?`;
      let respObj = {
       "payload": {
         "google": {
           "expectUserResponse": true,
           "systemIntent": {
             "intent": "actions.intent.PERMISSION",
             "data": {
              "@type": "type.googleapis.com/google.actions.v2.PermissionValueSpec",
              "optContext": "To find a branch near you",
              "permissions": [
                "NAME",
                "DEVICE_PRECISE_LOCATION"
               ]
             }
            }
          }
        }
      }
      res.json(respObj);
    }
    
    //Once the permission is obtained, find the location of user device
    if (queryResult.action === 'checkPermission') {
      //let params = queryResult.parameters.period;
      //console.log(params.arguments.textValue);
      console.log("Hi I am checkPermission");
    }
    
    //Action is to check interest rate
    if (queryResult.action === 'interest_rate') {
      let params = queryResult.parameters.period; 
      console.log(params.amount);
      console.log(params.unit);
      getInterestRate(params.amount, params.unit, (error, result) => {
        if(!error && result) {
          console.log(result);
          result = result + '\n' + 'Would you like to check the rate for another period?';
          let respObj = {
            fulfillmentText: result,
            "payload": {
              "google": {
                "expectUserResponse": true,
                "richResponse": {
                  "items": [
                    {
                      "simpleResponse": {
                        "textToSpeech": result
                      }
                    }
                  ],
                  "suggestions": [
                    {
                      "title": "Yes please"
                    },
                    {
                      "title": "No thanks"
                    }
                  ]
                }
              }
            }
          }
          res.json(respObj);
        }
      });
      
    }
    
    //Action is to check currency conversion
    if (queryResult.action === 'convert') {
      const {outputCurrency, amountToConvert} = queryResult.parameters;

      // Check if input currency code === output currency code
      if(amountToConvert.currency === outputCurrency) {
        const {
          amount
        } = amountToConvert;
        
        let responseText = `Well, ${amount} ${outputCurrency} is obviously equal to ${amount} ${outputCurrency}!`;
        let respObj = {
          fulfillmentText: responseText
        }
        res.json(respObj);
      } else {
        // Query the fixer.io API to fetch rates and create a response
        
        convertCurrency(amountToConvert, outputCurrency, (error, result) => {
          if(!error && result) {
            console.log(result);
            result = result + '\n' + 'Would you like to check another amount?';
            let respObj = {
              fulfillmentText: result,
              "payload": {
              "google": {
                "expectUserResponse": true,
                "richResponse": {
                  "items": [
                    {
                      "simpleResponse": {
                        "textToSpeech": result
                      }
                    }
                  ],
                  "suggestions": [
                    {
                      "title": "Yes please"
                    },
                    {
                      "title": "No thanks"
                    }
                  ]
                }
              }
              }
            }
            let contextStr = '[{"name": "interest_rate_query_context", "lifespan":0, "parameters":{}}]';
            let contextObj = JSON.parse(contextStr);
            res.json(respObj);
            res.contextOut(contextObj);
          }
        });
      }
    }  
  }

  return next();
});

server.listen(PORT, () => console.log(`BankOnMeBot running on ${PORT}`));
