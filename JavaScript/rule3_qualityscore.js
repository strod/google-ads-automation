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
    var goodQualityCost = 0;
    var poorQualityCost = 0;
    var poorQualityKeywords = [];
    
    Logger.log(`Campaign Id: ${campaignId}\tCampaign Name: ${campaignName}\n`);
    
    var keywordIterator = campaign.keywords()
      .withCondition("Status = ENABLED")
      .withCondition("Cost > 0")
      .orderBy("QualityScore DESC")
      .get();
    
    while (keywordIterator.hasNext()) {
      
      var keyword = keywordIterator.next();
      var keywordName = keyword.getText();
      var keywordId = keyword.getId();
    
      // Get Keyword Total Cost
      
      var keywordTotalCost = keyword.getStatsFor("LAST_30_DAYS").getCost();
      var kQualityScore = keyword.getQualityScore();
      
      //Logger.log(`Keyword Id: ${keywordId}\tTotal Cost: ${keywordTotalCost}\tQuality Score: ${kQualityScore}\tText: ${keywordName}\n`);
      
      // Accumulate the Total Cost for Good Quality Keywwords
      
      if (kQualityScore > 6) {
        
        goodQualityCost += keywordTotalCost;
        
      } else {
        
        // Accumulate the Total Cost for Poor Quality Keywwords
        
        poorQualityCost += keywordTotalCost;
        poorQualityKeywords.push({id: keywordId , name: keywordName, score: kQualityScore});
        
      }
      
    }
    
    // Calculate the Cost Share of poor quality keywoords
    
    var costShare = poorQualityCost / ( poorQualityCost + goodQualityCost )
    
    Logger.log(`Campaign Total Cost: ${totalCampaignCost}\t Low Quality Keyowrds Cost: ${poorQualityCost}\tPoor Quality Share: ${costShare}%\n\n`)
    
    if (costShare > 0.1) {
      var emailList = emailMap[advertiserId];
      if (!emailList) {
        Logger.log('??')
        continue;
      }
      
      var emailText = `The following Campaign :\nName: ${campaignName}\t Id: ${campaignId}\t Account: ${advertiserId} \nis spending more than allowed in low quality keywords (${costShare.toFixed(4)}%) in the past 30 days.\n`;
      
      emailText += `Here is a list of poor quality keywoords you could prune from the campaign:\n\n`
        
      poorQualityKeywords.forEach(function(keyword) {
        emailText += `keyword: ${keyword.name}\t\t\t(ID: ${keyword.id})\t\t\tQuality Score: ${keyword.score}\n`;
      });
      
      emailText += "\n Please check and make sure the rule is being implemented \n";
      emailText += "\n To avoid overspending on keywords with low quality scores, you could try the following: \n\n";
      emailText += "\n \t* Set bid adjustments: You could set bid adjustments to decrease your bids for keywords with low quality scores. \n";
      emailText += "\n \t* Use negative keywords: Identify and add negative keyqords to your campaign to prevent your ads from showing up for irrelevant searches. \n";
      emailText += "\n \t* Remove keywords: You could consider removing or pausing these keywords with low quality. \n";
      emailText += "\n \t* Use budget caps: Set budget caps for your campaign to ensure that you do not overspend on those bad quality keywords. \n";  
      emailText += "\n \t* Experiment with other targeting options: Try experimenting with other targeting options like location, device, and audiences to reach your target audience more effectively. \n";
      
      emailText += "\n Remember, it's important to continuosly monitor and optimize your campaign to ensure that you are getting the best possible results within your budget constraints. \n";
      
      sendEmails(emailList, `Golden Rules Alert | Right Content | Rule 3 - Quality Score [ ${campaignId} ]`, emailText);
      
      MailApp.sendEmail("rodrigo.teixeira@thrive-umww.com", `Golden Rules Alert | Right Content | Rule 3 - Quality Score [ ${campaignId} ]`, emailText)
      
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