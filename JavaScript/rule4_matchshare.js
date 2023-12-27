function main() {
  
  var spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1yEFWinuNWzX3CpHr9_CgWMWHBCvzRhbtWAxOAa0HlfY/edit#gid=0";
    // The URL of the Google Doc the results will be put into.
    // Copy the template at https://docs.google.com/spreadsheets/d/1yEFWinuNWzX3CpHr9_CgWMWHBCvzRhbtWAxOAa0HlfY/edit#gid=0
    // so you have the correct formatting and charts set up.

  var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  var sheet = spreadsheet.getSheetByName("stakeholders");
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var advertiserIndex = headers.indexOf("Advertiser ID");
  var emailIndex = headers.indexOf("Email");
  var emailMap = {};
  
  var advertiserId = AdsApp.currentAccount().getCustomerId();
  var advertiserName = AdsApp.currentAccount().getName();
  
  Logger.log(`Advertiser Id: ${advertiserId}\tAdvertiser Name: ${advertiserName}\n\n`);
  
  data.forEach(function(row) {
    var advertiserId = row[advertiserIndex];
    var email = row[emailIndex];
    
    if (!emailMap[advertiserId]) {
      emailMap[advertiserId] = [];
    }
    emailMap[advertiserId].push(email);
  });
  
  var campaignIterator = AdsApp.campaigns()
    .withCondition("Status = ENABLED")
    .withCondition("CampaignType = SEARCH")
    .withCondition("Cost > 1000")
    .forDateRange("LAST_30_DAYS")
    .orderBy("Cost DESC")
    .get();
  
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName();
    var campaignId = campaign.getId();
    
    // Variables to store the total amount spent on
    var totalCampaignCost = campaign.getStatsFor("LAST_30_DAYS").getCost();
    var exactMatchCost = 0;
    var broadMatchCost = 0;
    
    var exactKeywords = []
    var broadKeywords = []

    Logger.log(`Campaign Id: ${campaignId}\tCampaign Name: ${campaignName}\n`);
    
    var keywordIterator = campaign.keywords()
      .withCondition("Status = ENABLED")
      .forDateRange("LAST_30_DAYS")
      .withCondition("Cost > 0")
      .orderBy("Clicks DESC")
      .get();
    
    while (keywordIterator.hasNext()) {
      
      var keyword = keywordIterator.next();
      var keywordName = keyword.getText();
      var keywordId = keyword.getId();
      var keywordMatchType = keyword.getMatchType();
    
      // Get Keyword Stats for Data Range
      
      var keywordTotalCost = keyword.getStatsFor("LAST_30_DAYS").getCost();
      var keywordCPC = keyword.getStatsFor("LAST_30_DAYS").getAverageCpc() / 1000000;
      var keywordCTR = keyword.getStatsFor("LAST_30_DAYS").getCtr() * 100;
      
      
      //Logger.log(`Keyword Id: ${keywordId}\tTotal Cost: ${keywordTotalCost}\tMatch Type: ${keywordMatchType}\tText: ${keywordName}\n`);
      
      // Accumulate the Total Cost for Exact Match Keywwords
      
      if (keywordMatchType == `EXACT`) {
        
          exactMatchCost += keywordTotalCost;
        
          exactKeywords.push({id: keywordId, name: keywordName, cpc: keywordCPC, ctr: keywordCTR});
        
      } else {
        
        // Accumulate the Total Cost for Broad Match Keywwords
   
        broadMatchCost += keywordTotalCost;
   
        broadKeywords.push({id: keywordId, name: keywordName, cpc: keywordCPC, ctr: keywordCTR});
        
      }
      
    }
    
    // Calculate the Cost Share of poor quality keywoords
    
    var costShare = exactMatchCost / ( broadMatchCost + exactMatchCost )
    var costSharePCT = costShare * 100
    
    Logger.log(`Campaign Total Cost: ${totalCampaignCost.toFixed(2)}\tExact Match Total Cost: ${exactMatchCost.toFixed(2)}\tBroad Match Total Cost: ${broadMatchCost.toFixed(2)}\tExact Match Cost Share: ${costSharePCT.toFixed(1)}%\n\n`)
    
    if (costShare < 0.6) {
      var emailList = emailMap[advertiserId];
      if (!emailList) {
        Logger.log('??')
        continue;
      }
      
      var emailText = `The following Campaign :\n ${campaignName}\t(ID: ${campaignId}) is spending less than recommended on exact match keywords (${costSharePCT.toFixed(0)}%) in the past 30 days.\n`;
      
      emailText += `Here is the full list of used broad keywords. You might consider prune some bad performers from the campaign:\n\n`
        
      broadKeywords.forEach(function(keyword) {
        emailText += `ID: ${keyword.id}\t\t\CPC: ${keyword.cpc.toFixed(2)}\t\t\CTR: ${keyword.ctr.toFixed(2)}%\t\tkeyword: ${keyword.name}\n`;
      });
      
      emailText += "\n Please check and make sure the rule is being implemented \n";
      
      sendEmails(emailList, `Golden Rules Alert | Right Content | Rule 3 - Quality Score [ ${campaignId} ]`, emailText);
      
      Logger.log(`Email Sent to ${emailList}\n\n`);
      Logger.log(`${emailText}\n\n`)
    }
    
    if (costShare > 0.8) {
      var emailList = emailMap[advertiserId];
      if (!emailList) {
        Logger.log('??')
        continue;
      }
      
      var emailText = `The following Campaign :\n ${campaignName}\t(ID: ${campaignId}) is spending more than recommended on exact match keywords (${costSharePCT.toFixed(0)}%) in the past 30 days.\n`;
      
      emailText += `Here is the full list of used exact keywords. You might consider prune some bad performers from the campaign:\n\n`
        
      exactKeywords.forEach(function(keyword) {
        emailText += `ID: ${keyword.id}\t\t\CPC: ${keyword.cpc.toFixed(2)}\t\t\CTR: ${keyword.ctr.toFixed(2)}%\t\tkeyword: ${keyword.name}\n`;
      });
      
      emailText += "\n Please check and make sure the rule is being implemented \n";
      
      sendEmails(emailList, `Golden Rules Alert | Right Content | Rule 3 - Quality Score [ ${campaignId} ]`, emailText);
      
      Logger.log(`Email Sent to ${emailList}\n\n`);
      Logger.log(`${emailText}\n\n`)
    }
    
  }
  
}

function sendEmails(to, subject, body) {
to.forEach(function(email) {
  MailApp.sendEmail(email, subject, body);
});
}
