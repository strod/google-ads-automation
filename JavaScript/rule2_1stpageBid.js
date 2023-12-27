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
        .get();

    while (campaignIterator.hasNext()) {
        var campaign = campaignIterator.next();
        var campaignName = campaign.getName();
        var campaignId = campaign.getId();
    }
}