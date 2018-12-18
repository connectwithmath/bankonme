'use strict';
const express = require('express');
const { dialogflow } = require('actions-on-google');
const bodyParser = require('body-parser');

const fs = require('fs');
const request = require('request');
const PORT = process.env.PORT || 8000;

var server = express();

server.use(bodyParser());
//server.use(jsonp());

server.post('/',function(req,res){
  
  let {queryResult} = req.body;

  //console.log(queryResult);
  //console.log(queryResult.action);

  //=====================================================================
  //Functions (Request handlers)
  //=====================================================================

  //Get Interest rate

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
        cb(null, `For a period of ${period} ${unit}, the rate of interest is not available. Please try for another period.`);  
      } else {
        cb(null, `For a period of ${period} ${unit}, the rate of interest is ${interest_rate}`);
      }
  });
  
  }
  
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

  //Get Account Balance
  const directLogin = function (err, res, data) {
    console.log("Action is " + queryResult.action);
    var direct_login_post_options = {
      uri: 'https://apisandbox.openbankproject.com/my/logins/direct',
      path: '/my/logins/direct',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization' :'DirectLogin username="Deodatta", password="Somalwar@440010", consumer_key = "5rorct2i353lsq3eix1ikxavlmhv0gvbcddvozkf"'
      }
    };
   
    request(direct_login_post_options, function (error, response, data) {
      if (error) {
      console.log("Error" , error);
      return;
      }
        
      var stringifiedData = JSON.stringify(response);
      var parsedData = JSON.parse(stringifiedData);
      //console.log(parsedData);
    
      var statusCode = parsedData.statusCode;
      //console.log(statusCode);
      var token = JSON.parse(parsedData.body).token;
    
      //console.log(token);

      getAccounts(token, data);
    
      //res.balance = token;
    });
  }

  var getAccounts = function (token, data){
    console.log("I have reached getAccounts");
    
    //console.log("Token received " + token);
    var account_post_options = {
      uri: 'https://apisandbox.openbankproject.com/obp/v3.1.0/banks/rbs/accounts-held',
      path: '/obp/v3.1.0/banks/rbs/accounts-held',
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
          'Authorization' :'DirectLogin token=' + token
      }
    };
     
    request(account_post_options, function (error, response, data) {
      if (error) {
       console.log("Error" , error);
       return;
      }
        
      var stringifiedData = JSON.stringify(response);
      var parsedData = JSON.parse(stringifiedData);
      console.log(parsedData);
        
      var statusCode = parsedData.statusCode;
      //console.log(statusCode);
      var body = JSON.parse(parsedData.body);
      //console.log(body);
      var accounts = JSON.parse(parsedData.body).accounts;
      console.log("You have ", accounts.length, " accounts");
      
      //Call getAccountBalance function if the action is account_balance or pay_someone
      if (queryResult.action === 'account_balance' || queryResult.action === 'pay_someone') {    
        getAccountBalance(token, accounts, data);
      }

      //Call getLast5Tran if the action is last_5_tran
      if (queryResult.action === 'last_5_tran') {    
        getLast5Tran(token, accounts, data);
      }

    }); 
  }
  
  var getLast5Tran = function (token, accounts, data) {
    
    console.log("Account " + accounts);
    console.log("In getBalance Action is " + queryResult.action);
    var len = accounts.length;
    
    var tran_arr = [];
    
    var account_counter = 0;
    for(var i=0;  i < len; i++) {
      var account_id = JSON.parse(JSON.stringify(accounts[i])).id;
        

      var obp_uri = 'https://apisandbox.openbankproject.com/obp/v3.1.0/my/banks/rbs/accounts/' + account_id + '/transactions';
      //console.log(obp_uri);
  
      var obp_path = '/obp/v3.1.0/my/banks/rbs/accounts/' + account_id + '/transactions'
      var get_tran_post_options = {
        uri: obp_uri,
        path: obp_path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization' :'DirectLogin token=' + token
      
        }
      };
  
      request(get_tran_post_options, function (error, response, body) {
        if (error) {
        console.log("Error" , error);
        return;
        }
        else {
          var statusCode = response.statusCode;
          //console.log(statusCode);
          console.log(account_id);
          tran_arr.push("Transactions in account " + account_id + '\n');
          var transaction_recs = JSON.parse(body);
          var tran_len = transaction_recs.transactions.length;
          if (tran_len > 5) {tran_len = 5;} 
          var tran_counter = 0;
          for (var j=0;  j < tran_len; j++) {
            var transaction_date = transaction_recs.transactions[j].details.posted ;
            var transaction_amount = transaction_recs.transactions[j].details.value ;
            let tran_str = transaction_date.substring(0,10) + "     " + transaction_amount.currency + "  " + transaction_amount.amount 
            console.log(tran_str);
            tran_counter += 1;
            tran_arr.push(tran_str + '\n');
          }


          account_counter += 1;
          
          if (tran_counter === tran_len && account_counter === len) {
            console.log(tran_arr.toString());            
            let respObj = {
              fulfillmentText: tran_arr.join(" ") + '\n' + 'What else can I do for you?' + '\n' + 
              'For interest rate query, type Interest rates query' + '\n' + 
              'For currency conversion rates, type Currency Conversion' + '\n' + 
              'For making a payment to someone, type Make Payment' + '\n'+
              'To check account balance, type Account Balance' + '\n' +
              'To check your previous transactions, type Last few transactions' + '\n', 
              "payload": {
                "google": {
                  "expectUserResponse": true,
                  "richResponse": {
                    "items": [
                      {
                        "simpleResponse": {
                          "textToSpeech": tran_arr.join(" ") + '\n' + 'What else can I do for you?',
                          "displayText": tran_arr.join(" ") + '\n' + 'What else can I do for you?' 
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
                        "title": "Make a payment"
                      },
                      {
                        "title": "My account balance"
                      },
                      {
                        "title": "Last 5 transactions"
                      }
                    ]
                  }
                }
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.json(respObj);
          }
          
        }
      })

    }
  }

  var getAccountBalance = function (token, accounts, data){
    
    console.log("Account " + accounts);
    console.log("In getBalance Action is " + queryResult.action);
    var len = accounts.length;
    var result_str = "You have " + len + " accounts. " + "\n"; 
    var result_arr = [];
    result_arr.push(result_str);
    var account_counter = 0;
    for(var i=0;  i < len; i++)
    {
      var account_id = JSON.parse(JSON.stringify(accounts[i])).id;
      console.log(account_id);

      var obp_uri = 'https://apisandbox.openbankproject.com/obp/v3.1.0/my/banks/rbs/accounts/' + account_id + '/account';
      //console.log(obp_uri);
  
      var obp_path = '/obp/v3.1.0/my/banks/rbs/accounts/' + account_id + '/account'
      var account_balance_post_options = {
        uri: obp_uri,
        path: obp_path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization' :'DirectLogin token=' + token
      
        }
      };
  
      request(account_balance_post_options, function (error, response, body) {
        if (error) {
        console.log("Error" , error);
        return;
        }
        else {
          var statusCode = response.statusCode;
          //console.log(statusCode);
          var body = JSON.parse(body);
          //console.log("Body ==========", body);
          var balance_str = "Balance of " + body.id + " is " + body.balance.currency + " " + body.balance.amount + ". \n";
          //console.log(balance_str);
          account_counter +=1;
          console.log(account_counter);
          result_arr.push(balance_str);  
          console.log(result_arr.join(""));
          
          if (queryResult.action === 'account_balance' && account_counter === len) {
            //console.log("I am sending result");
            
            let respObj = {
              fulfillmentText: result_arr.join(" ") + '\n' + 'What else can I do for you?' + '\n' + 
              'For interest rate query, type Interest rates query' + '\n' + 
              'For currency conversion rates, type Currency Conversion' + '\n' + 
              'For making a payment to someone, type Make Payment' + '\n'+
              'To check account balance, type Account Balance' + '\n' +
              'To check your previous transactions, type Last few transactions' + '\n', 
              "payload": {
                "google": {
                  "expectUserResponse": true,
                  "richResponse": {
                    "items": [
                      {
                        "simpleResponse": {
                          "textToSpeech": result_arr.join(" ") + '\n' + 'What else can I do for you?'
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
                        "title": "Make a payment"
                      },
                      {
                        "title": "My account balance"
                      },
                      {
                        "title": "Last 5 transactions"
                      }
                    ]
                  }
                }
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.json(respObj);
          }
        }
      })
  

    } 
  
    

    if (queryResult.action === 'pay_someone') {
      console.log('Pay someone');
      var tran_payee = queryResult.parameters.Payee;
            var body = JSON.stringify(queryResult.parameters);
      var parsedBody = JSON.parse(body);
      var tran_amt = parsedBody['unit-currency'].amount;
      var tran_ccy = parsedBody['unit-currency'].currency;
      var tran_desc = queryResult.queryText;

      createTransaction(token, account_id, tran_payee, tran_amt, tran_ccy, tran_desc);
    }
  
  }

  var createTransaction = function (token, account_id, tran_payee, tran_amt, tran_ccy, tran_desc){
    //console.log("I have reached createTransaction");
    //console.log("Token received " + token);
    //console.log("Account " + account_id);
    //console.log("In getBalance Action is " + queryResult.action);  
    var obp_uri = 'https://apisandbox.openbankproject.com/obp/v3.1.0/banks/rbs/accounts/' + account_id + '/owner/transaction-request-types/SANDBOX_TAN/transaction-requests';
    console.log(obp_uri);
  
    
    var obp_path = '/obp/v3.1.0/my/banks/rbs/accounts/' + account_id + '/account'
    var create_tran_post_options = {
      uri: obp_uri,
      path: obp_path,
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization' :'DirectLogin token=' + token
      },
      body: JSON.stringify(
      {
      to: {    
            'bank_id':'rbs',
            'account_id':'rbs-deo-testaccount-001'
      },  
      value: {
            'currency': tran_ccy,
            'amount':tran_amt  
      },
      description:tran_desc
      })
    
    };  
  
    request(create_tran_post_options, function (error, response, body) {
      if (error) {
       console.log("Error" , error);
       return;
      }
      
      var statusCode = response.statusCode;
      console.log("Status Code ", statusCode);
      //var body = JSON.parse(body);
      //var balance = body.balance.currency + " " + body.balance.amount;
      console.log("Body " , body);
      
      if (queryResult.action === 'pay_someone' && statusCode === 201) {
        let result = "Your payment of " + tran_ccy + " " + tran_amt + " to " + tran_payee + " is completed successfully. Payment has been made from account " + account_id + '\n' 
        + 'What else can I do for you?' + '\n' + 
              'For interest rate query, type Interest rates query' + '\n' + 
              'For currency conversion rates, type Currency Conversion' + '\n' + 
              'For making a payment to someone, type Make Payment' + '\n'+
              'To check account balance, type Account Balance' + '\n' +
              'To check your previous transactions, type Last few transactions' + '\n' ;

        let respObj = {
          fulfillmentText: result,
          "payload": {
            "google": {
              "expectUserResponse": true,
              "richResponse": {
                "items": [
                  {
                    "simpleResponse": {
                      "textToSpeech": "Your payment of " + tran_ccy + " " + tran_amt + " to " + tran_payee + " is completed successfully." + "\n" + "Payment has been made from account " + account_id + '\n'
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
                    "title": "Make a payment"
                  },
                  {
                    "title": "My account balance"
                  },
                  {
                    "title": "Last 5 transactions"
                  }
                ]
              }
            }
          }
        }
        res.json(respObj);
      }
      
   })
  
  }

  //Check actions
  if (queryResult.action === 'input.welcome') {
    console.log('Inside welcome');
    let result = `\n  + 'What else can I do for you?' + '\n' + 
    'For interest rate query, type Interest rates query' + '\n' + 
    'For currency conversion rates, type Currency Conversion' + '\n' + 
    'For making a payment to someone, type Make Payment' + '\n'+
    'To check account balance, type Account Balance' + '\n' +
    'To check your previous transactions, type Last few transactions' + '\n'`,
    
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
                    "title": "Make a payment"
                  },
                  {
                    "title": "My account balance"
                  },
                  {
                    "title": "Last 5 transactions"
                  }
                ]
              }
            }
          }
    }
    res.json(respObj);
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
          //res.contextOut(contextObj);
        }
      });
    }
  }
  
  if (queryResult.action === 'account_balance') {
    
    directLogin((error, res, result) => {
      console.log(error);
      if(!error) {
        result = result + '\n' + res;
        let respObj = {
          fulfillmentText: result
        }
        res.json(respObj);
      }
    });
    
  }

  if (queryResult.action === 'last_5_tran') {
    
    directLogin((error, res, result) => {
      console.log(error);
      if(!error) {
        result = result + '\n' + res;
        let respObj = {
          fulfillmentText: result
        }
        res.json(respObj);
      }
    });
    
  }

  if (queryResult.action === 'pay_someone') {

    console.log(queryResult.action);
    const payee = queryResult.parameters.Payee;
    console.log(payee);
    const {amount} = queryResult.parameters;
    
    directLogin(payee, (error, res, result) => {
      console.log(error);
      if(!error) {
        result = result + '\n' + res;
        let respObj = {
          fulfillmentText: result
        }
        res.json(respObj);
      }
    });
    
  }

  
});

server.listen(PORT, () => console.log(`BankOnMeBot running on ${PORT}`));
