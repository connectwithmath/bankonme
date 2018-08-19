'use strict';
const Restify = require('restify');
const { dialogflow } = require('actions-on-google');

const server = Restify.createServer({
  name: "bankonme"
});
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
  
  switch(unit){
      case 'day':
        cb(null, `For a period of ${period} day(s), the rate of interest is 5%`);
        break;
      case 'mo':
        cb(null, `For a period of ${period} months(s), the rate of interest is 6%`);
        break;
      case 'yr':
        cb(null, `For a period of ${period} years(s), the rate of interest is 7%`);
        break;
      default:
        cb(null, `Please enter the Fixed Deposit term/duration in days, months or years`);
        break;
  }   
}

// POST route handler
server.post('/', (req, res, next) => {
  //const app = new DialogflowApp({request:req, response:res}); 
  
  let {queryResult} = req.body;

  //console.log(queryResult);
  
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
      
      const app = dialogflow({debug: true});
          
      // Create a Dialogflow intent with the `actions_intent_PERMISSION` event
      app.intent('Nearby ATM Branch', (conv) => {
        
        const options = {
          context: 'To find the nearest branch/ATM near you,',
          permissions: ['NAME', 'DEVICE_PRECISE_LOCATION'],
        };
      });
      conv.ask(`I am doing good`);
      conv.ask(new Permission(options));
            
      console.log('I am here');
      let responseText = `Well, Let me find out the nearest branch/ATM!!`;
      let respObj = {
          fulfillmentText: responseText
      }
      res.json(respObj);
      //app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
      //app.askForPermission('To find the closest ATM or branch', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
			
    }
    
    //Once the permission is obtained, find the location of user device
    if (queryResult.action === 'nearbyATMBranch') {
    
    }
    
    //Action is to check interest rate
    if (queryResult.action === 'interest_rate') {
      let params = queryResult.parameters.period; 
      console.log(params.amount);
      console.log(params.unit);
      getInterestRate(params.amount, params.unit, (error, result) => {
        if(!error && result) {
          console.log(result);
          let respObj = {
            fulfillmentText: result
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
            let respObj = {
              fulfillmentText: result
            }
            res.json(respObj);
          }
        });
      }
    }  
  }

  return next();
});

server.listen(PORT, () => console.log(`BankOnMeBot running on ${PORT}`));
