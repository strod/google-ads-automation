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
  
  Logger.log("Advertiser ID: " + advertiserId + " Advertiser Name: " + advertiserName + "\n\n");
  
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
    .get();
  
  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var campaignName = campaign.getName();
    var campaignId = campaign.getId();
    
    var adGroups = campaign.adGroups().withCondition("Status = ENABLED").get();
    var missingAdGroups = [];
    
    while (adGroups.hasNext()) {
      var adGroup = adGroups.next();
      var adGroupName = adGroup.getName();
      var adGroupId = adGroup.getId();
      var responsiveAds = adGroup.ads().withCondition("Type = RESPONSIVE_SEARCH_AD").get();
      var responsiveAdsCount = responsiveAds.totalNumEntities();
      Logger.log("Campaign ID: " + campaignId + ", Ad Group ID: " + adGroupId + ", Responsive Ads: " + responsiveAdsCount);
      
      if (responsiveAdsCount < 2) {
        missingAdGroups.push({id: adGroupId, name: adGroupName});
      }
    }
    
    if (missingAdGroups.length > 0) {
      var emailList = emailMap[advertiserId];
      if (!emailList) {
        continue;
      }
      
      var emailText = `The following Campaign :\n ${campaignName}\n(ID: ${campaignId}) is missing at least two responsive ads in the following ad groups:\n\n`;
      missingAdGroups.forEach(function(adGroup) {
        emailText += `Ad Group: ${adGroup.name}\t\t\t(ID: ${adGroup.id})\n`;
      });
      
      emailText += "\n Please check and make sure the rule is being implemented \n";
      sendEmails(emailList, `Golden Rules Alert | Right Content | Rule 2 - Responsive Ads [ ${campaignId} ]`, emailText);
    }
  }
}

function sendEmails(to, subject, body) {
  to.forEach(function(email) {
    MailApp.sendEmail(email, subject, body);
  });
}
