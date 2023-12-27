/**
*
* Heat Map Creation Tool
*
* This script calculates the smoothed average performance of each hour of each day
* of the week, and outputs this into a heat map and graph in a Google sheet. It
* also makes suggested bid adjustments based on the conversion rate.
*
* Version: 1.1
* Updated 2022-09-13: removed 'ConvertedClicks'.
* Google AdWords Script maintained by Thrive (dev.thrive@umww.com) 
*
**/

function main() {
  //////////////////////////////////////////////////////////////////////////////
  // Options 
  
  var spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1bQHnxyL9vEAppRNgqtw8BWLT_cNlwzsNQzQRKG62778/edit#gid=1022438191";
  // The URL of the Google Doc the results will be put into.
  // Copy the template at https://docs.google.com/spreadsheets/d/1W8B-wdgU8oBkFmK53nZUULvkcPJ7ajVmzepLw2A04Uw/edit#gid=1022438191
  // so you have the correct formatting and charts set up.
      
  var fields = ["Impressions", "Clicks", "Conversions", "ConversionValue"];
  // Make heat maps of these fields.
  // Allowed values: "Impressions", "Clicks", "Cost",
  // "Conversions", "ConversionValue"
  
  var calculatedFields = ["Clicks/Impressions", "Conversions/Clicks", "ConversionValue/Conversions"];
  // Make heat maps of a stat calculated by dividing one field by another. 
  // For example "Clicks/Impressions" will give the average clicks divided by the
  // average impressions (ie the CTR).
  // Allowed fields: "Impressions", "Clicks", "Cost",
  // "Conversions", "ConversionValue"
  
  var campaignNameContains = "BR_NEST_l56_pt_GO_Brand_Nonbrand_NA_NA_CON_MLTPLE_Brasil_Cadastro_4571618169_RECEITAS NESTLÉ";
  // Use this if you only want to look at some campaigns
  // such as campaigns with names containing 'Brand' or 'Shopping'.
  // Leave as "" if not wanted.
  
  var campaignNameDoesNotContain = "";
  // Use this if you want to exclude some campaigns
  // such as campaigns with names containing 'Brand' or 'Shopping'.
  // Leave as "" if not wanted.
  
  var ignorePausedCampaigns = true;
  // Set this to true to only look at currently active campaigns.
  // Set to false to include campaigns that had impressions but are currently paused.
  
  var ignoreDates = []
  
  //////////////////////////////////////////////////////////////////////////////
  // Advanced settings.
  
  var smoothingWindow = [-2,   -1,   0,   1,    2   ];
  var smoothingWeight = [0.25, 0.75, 1,   0.75, 0.25];
  // The weights used for smoothing.
  // The smoothingWindow gives the relative hour (eg 0 means the current hour,
  // -2 means 2 hours before the current hour) and the smoothingWeight gives the
  // weighting for that hour.
  
  var maxBidMultiplierSuggestion = 0.35;
  var minBidMultiplierSuggestion = -0.35;
  // The maximum and minimum for the suggested bidding multipliers.
  
  
  //////////////////////////////////////////////////////////////////////////////
  
  // Check the spreadsheet works.
  try {
    var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  } catch (e) {
    throw "Problem with the spreadsheet URL, please check you have copied your URL in correctly. '" + e + "'";
  }
  
  // Check the field names are correct
  var allowedFields = ["Conversions", "ConversionValue", "Impressions", "Clicks", "Cost"];
  var allowedFields_lowerCase = allowedFields.map(function (str){return str.toLowerCase()});
  var unrecognisedFields = [];
  
  for (var i=0; i<fields.length; i++) {
    var fieldIndex = allowedFields_lowerCase.indexOf(fields[i].toLowerCase().replace(" ","").trim());
    if(fieldIndex === -1){
      unrecognisedFields.push(fields[i]);
    }
    fields[i] = allowedFields[fieldIndex];
  }
  
  var calculatedFieldComponents = [];
  var unrecognisedCalculatedFields = [];
  for (var i=0; i<calculatedFields.length; i++) {
    if (calculatedFields[i].indexOf("/") === -1) {
      unrecognisedCalculatedFields.push(calculatedFields[i]);
      continue;
    }
    var components = calculatedFields[i].split("/");
    var toUse = [];
    for (var j=0; j<components.length; j++){
      components[j] = components[j].trim();
      var fieldIndex = allowedFields_lowerCase.indexOf(components[j].toLowerCase().replace(" ",""));
      if(fieldIndex === -1){
        unrecognisedCalculatedFields.push(components[j] + "' in '" + calculatedFields[i]);
      }
      toUse.push(allowedFields[fieldIndex]);
      if (fields.indexOf(allowedFields[fieldIndex]) === -1) {
        calculatedFieldComponents.push(allowedFields[fieldIndex]);
      }
    }
    calculatedFields[i] = toUse;
  }
  
  if (unrecognisedFields.length > 0 || unrecognisedCalculatedFields.length > 0) {
    throw unrecognisedFields.length + " field(s) and " + unrecognisedCalculatedFields.length +
      " calculated fields not recognised: '" + unrecognisedFields.concat(unrecognisedCalculatedFields).join("', '") + 
        "'. Please choose from '" + allowedFields.join("', '") + "'.";
  }
  
  var allFields = fields.concat(calculatedFieldComponents);
  if (allFields.indexOf("Clicks") < 0) {
    allFields.push("Clicks");
  }
  if (allFields.indexOf("Conversions") < 0) {
    allFields.push("Conversions");
  }
  
  var dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  var dailyData = {}
  var numberDays = {};
  var smoothedData = {};
  
  // Initialise data
  for (var d=0; d<dayNames.length; d++) {
    smoothedData[dayNames[d]] = {};
    numberDays[dayNames[d]] = 0;
    for (var h=0; h<24; h++) {
      smoothedData[dayNames[d]][h+""] = {};
      for (var f=0; f<allFields.length; f++) {
        smoothedData[dayNames[d]][h+""][allFields[f]] = 0;
      }
    }
  }
  
  // Construct the report
  if (ignorePausedCampaigns) {
    var whereStatements = "CampaignStatus = ENABLED ";
  } else {
    var whereStatements = "CampaignStatus IN ['ENABLED','PAUSED'] ";
  }
  
  if (campaignNameDoesNotContain != "") {
    whereStatements += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain + "' ";
  }
  
  if (campaignNameContains != "") {
    whereStatements += "AND CampaignName CONTAINS_IGNORE_CASE '" + campaignNameContains + "' ";
  }
  
  for (var d=0; d<31; d++) {
    var report = AdWordsApp.report("SELECT DayOfWeek, Date, HourOfDay, " + allFields.join(", ") + " " +
      "FROM CAMPAIGN_PERFORMANCE_REPORT " +
        "WHERE " + whereStatements +
          //"DURING " + dateRanges[d].replace(/-/g,"")
          "DURING LAST_30_DAYS"
          );
    
    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      if (ignoreDates.indexOf(row["Date"]) > -1) {
        continue;
      }
      if (dailyData[row["Date"]] == undefined) {
        dailyData[row["Date"]] = {};
        dailyData[row["Date"]]["Day"] = row["DayOfWeek"];
        for (var h=0; h<24; h++) {
          dailyData[row["Date"]][h+""] = {};
          for (var f=0; f<allFields.length; f++) {
            dailyData[row["Date"]][h+""][allFields[f]] = 0;
          }
        }
      }
      
      for (var f=0; f<allFields.length; f++) {
        dailyData[row["Date"]][row["HourOfDay"]][allFields[f]] += parseInt(row[allFields[f]].replace(/,/g,""),10);
      }
    } // end while
    
  }// end for dateRanges
  
  
  // Daily data is smoothed and totaled for each day of week
  for (var date in dailyData) {
    var day = dailyData[date]["Day"];
    numberDays[day]++;
    
    var dateBits = date.split("-");
    var yesterday = new Date(dateBits[0],parseInt(dateBits[1],10)-1,parseInt(dateBits[2],10)-1);
    var tomorrow = new Date(dateBits[0],parseInt(dateBits[1],10)-1,parseInt(dateBits[2],10)+1);
    yesterday = Utilities.formatDate(yesterday, "UTC", "yyyy-MM-dd");
    tomorrow = Utilities.formatDate(tomorrow, "UTC", "yyyy-MM-dd");
    
    for (var h=0; h<24; h++) {
      
      for (var f=0; f<allFields.length; f++) {
        var totalWeight = 0;
        var smoothedTotal = 0;
        
        for (var w=0; w<smoothingWindow.length; w++) {
          if (h + smoothingWindow[w] < 0) {
            if (dailyData[yesterday] != undefined) {
              totalWeight += smoothingWeight[w];
              smoothedTotal += smoothingWeight[w] * dailyData[yesterday][(h + smoothingWindow[w] + 24)][allFields[f]];
            }
          } else if (h + smoothingWindow[w] > 23) {
            if (dailyData[tomorrow] != undefined) {
              totalWeight += smoothingWeight[w];
              smoothedTotal += smoothingWeight[w] * dailyData[tomorrow][(h + smoothingWindow[w] - 24)][allFields[f]];
            }
          } else {
            totalWeight += smoothingWeight[w];
            smoothedTotal += smoothingWeight[w] * dailyData[date][(h + smoothingWindow[w])][allFields[f]];
          }
        }
        if (totalWeight != 0) {
          smoothedData[day][h][allFields[f]] += smoothedTotal / totalWeight;
        }
      }
    }
  } // end for dailyData
  Logger.log("Collected daily data.");
  
  
  // Calculate the averages from the smoothed data
  var hourlyAvg = {};
  var totalImpressions = 0;
  var totalConversions = 0;
  var totalClicks = 0;
  var totalRegisters = 0;

  for (var d=0; d<dayNames.length; d++) {
    hourlyAvg[dayNames[d]] = {};
    for (var h=0; h<24; h++) {
      hourlyAvg[dayNames[d]][h+""] = {}
      
      if (numberDays[dayNames[d]] == 0) {
        for (var f=0; f<allFields.length; f++) {
          hourlyAvg[dayNames[d]][h+""][allFields[f]] = "-";
        }
        continue;
      }
      
      for (var f=0; f<allFields.length; f++) {
        hourlyAvg[dayNames[d]][h+""][allFields[f]] = smoothedData[dayNames[d]][h+""][allFields[f]]/numberDays[dayNames[d]];
      }
      
      for (var c=0; c<calculatedFields.length; c++) {
        
        var multiplier = smoothedData[dayNames[d]][h+""][calculatedFields[c][0]];
        var divisor = smoothedData[dayNames[d]][h+""][calculatedFields[c][1]];
        
        if (divisor == 0 || divisor == "-" || multiplier == "-") {
          hourlyAvg[dayNames[d]][h+""][calculatedFields[c].join("/")] = "-";
        } else {
          hourlyAvg[dayNames[d]][h+""][calculatedFields[c].join("/")] = multiplier / divisor;
        }
      }
      
      // Add up the clicks and conversions, for generating the suggested bidding multipliers
      totalConversions += smoothedData[dayNames[d]][h+""]["Conversions"];
      totalClicks += smoothedData[dayNames[d]][h+""]["Clicks"];
      totalImpressions += smoothedData[dayNames[d]][h+""]["Impressions"];
    }
  }
  
  // Calculate suggested bidding multipliers based on conversion rate weighted by the volume of conversions
  if (totalClicks == 0) {
    var meanConvRate = 0;
    var meanCTR = 0;
  } else {
    var meanConvRate = totalConversions / totalClicks;
    var meanCTR = totalClicks / totalImpressions;
  }
  
  var meanConv = totalConversions / 168

  for (var d=0; d<dayNames.length; d++) {
    for (var h=0; h<24; h++) {
      
      if (meanConvRate == 0 || smoothedData[dayNames[d]][h+""]["Clicks"] == 0) {
        hourlyAvg[dayNames[d]][h+""]["BiddingMultipliers"] = "-";
      } else {
        // CTR Opt
        // var ctr = smoothedData[dayNames[d]][h+""]["Clicks"] / smoothedData[dayNames[d]][h+""]["Impressions"];
        
        // Conversion Opt
        var convRate = smoothedData[dayNames[d]][h+""]["Conversions"] / smoothedData[dayNames[d]][h+""]["Clicks"]
        
        // The suggested multiplier is generated from the mean.
        // It is dampened by taking the square root.
        
        // var absMultiplier = ctr/meanCTR - 1
        
        var absMultiplier = convRate / meanConvRate - 1
        
        if (absMultiplier < 0){
          var multiplier = -1*(absMultiplier**2);
        } else {
          var multiplier = absMultiplier**2;
        }
        
        // Logger.log(`Day: ${dayNames[d]}\t| Hour: ${h}\t| Avg Conversions: ${meanConv.toFixed(2)}\t| Conversions: ${conv.toFixed(2)}\t| Multiplier Abs: ${absMultiplier.toFixed(2)}\t| Final Multiplier ${multiplier.toFixed(2)}`);
        
        if (multiplier > maxBidMultiplierSuggestion) {
          multiplier = maxBidMultiplierSuggestion;
        } else if (multiplier < minBidMultiplierSuggestion) {
          multiplier = minBidMultiplierSuggestion;
        } 
        hourlyAvg[dayNames[d]][h+""]["BiddingMultipliers"] = multiplier;
      }
      
    }
  }
  
  Logger.log("Averaged and smoothed data.");
  
  // Make the heat maps on the spreadsheet
  var sheet0 = spreadsheet.getSheets()[0];
  var calculatedFieldNames = calculatedFields.map(function (arr){return arr.join("/")});
  var allFieldNames = fields.concat(calculatedFieldNames,["BiddingMultipliers"]);
  if (sheet0.getName() == "Template") {
   sheet0.setName(allFieldNames[0].replace(/[A-Z\/]/g, function (x){return " " + x;}).trim());
  }
  
  for (var f=0; f<allFieldNames.length; f++) {
    var fieldName = allFieldNames[f].replace(/[A-Z\/]/g, function (x){return " " + x;}).trim();
    var sheet = spreadsheet.getSheetByName(fieldName);
    if (sheet == null) {
      sheet = sheet0.copyTo(spreadsheet);
      sheet.setName(fieldName);
    }
    sheet.getRange(1, 1).setValue(fieldName);
    
    //Post the heat map data
    var sheetData = [];
    sheetData.push([""].concat(dayNames)); // The header
    var totalValue = 0;
    for (var h=0; h<24; h++) {
      var rowData = [h];
      for (var d=0; d<dayNames.length; d++) {
        if (hourlyAvg[dayNames[d]][h+""][allFieldNames[f]] == undefined) {
          rowData.push("-");
        } else {
          rowData.push(hourlyAvg[dayNames[d]][h+""][allFieldNames[f]]);
        }
        totalValue += hourlyAvg[dayNames[d]][h+""][allFieldNames[f]];
      }
      sheetData.push(rowData);
    }
    sheet.getRange(3, 1, sheetData.length, sheetData[0].length).setValues(sheetData);
    
    // Work out which format to use and format the numbers in the heat map
    var averageValue = totalValue / (24*7);
    if (averageValue < 50) {
      var format = "#,##0.00";
    } else {
      var format = "#,##0";
    }
    if (allFieldNames[f].indexOf("/") > -1) {
      var components = allFieldNames[f].split("/");
      var multiplierIsMoney = (components[0] == "Cost" || components[0] == "ConversionValue");
      var divisorIsMoney = (components[1] == "Cost" || components[1] == "ConversionValue");
      if ((!multiplierIsMoney && !divisorIsMoney) || (multiplierIsMoney && divisorIsMoney)) {
        // If neither component is monetary, or both components are, then the result is a percentage
        format = "#,##0.00%";
      }
    }
    if (allFieldNames[f] == "BiddingMultipliers") {
      format = "#,##0.00%";
    }
    var numberFormats = [];
    for (var i=0; i<24; i++) {
      var formatRow = [];
      for (var j=0; j<7; j++) {
        formatRow.push(format);
      }
      numberFormats.push(formatRow);
    }
    sheet.getRange(4, 2, numberFormats.length, numberFormats[0].length).setNumberFormats(numberFormats);
    
    // Update the chart title
    var charts = sheet.getCharts();
    if (sheet.getCharts().length === 0) {
      Logger.log("Warning: chart missing from the " + fieldName + " sheet."); 
    } else {
      var chart = charts[0];
      chart = chart.modify().setOption('title', fieldName).build();
      sheet.updateChart(chart);
    }
  }
  
  Logger.log("Posted data to spreadsheet.");
  Logger.log("Finished.");
}