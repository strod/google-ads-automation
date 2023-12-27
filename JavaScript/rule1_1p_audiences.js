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
    
    // Getting All 1P User Lists
    first_party_lists = []

    var userLists = AdsApp.userlists()
      .withCondition("user_list.type IN (CRM_BASED, REMARKETING)")
      .get();
      
    while (userLists.hasNext()) {
        ulist = userLists.next();
        first_party_lists.push(ulist.getName());
 
      }


    var campaignIterator = AdsApp.campaigns()
      .forDateRange("LAST_30_DAYS")
      .withCondition("Status = ENABLED")
      .withCondition("CampaignType = SEARCH")
      .withCondition("metrics.clicks > 0")
      .orderBy("metrics.clicks DESC")
      .get();
    
    while (campaignIterator.hasNext()) {
      
      var campaign = campaignIterator.next();
      var campaignName = campaign.getName();
      var campaignId = campaign.getId();
      
      // Getting Campaign Total Cost
      var campaignTotalCost = campaign.getStatsFor("LAST_30_DAYS").getCost();
      var firstPartyCost = 0;
      var adGroups = campaign.adGroups().withCondition("Status = ENABLED").get();
      
      Logger.log(`\n\nCampaign Id: ${campaignId}\tCampaign Name: ${campaignName}\tCampaign Total Cost: ${campaignTotalCost}\n\n`);

      
      
      var audienceIterator = campaign.targeting().audiences()
        .withCondition("metrics.clicks > 0")
        .withCondition("Status = ENABLED")
        // .withCondition(`UserListName IN (${first_party_lists})`)
        .orderBy("metrics.clicks DESC")
        .get();
      
      var numAudiences = audienceIterator.totalNumEntities();
      
      Logger.log(`Number of audiences in this campaign: ${numAudiences}\n\n`)
      
      while (audienceIterator.hasNext()) {
        
        var audience = audienceIterator.next();
        var audienceName = audience.getName();
        var audienceType = audience.getAudienceType();
        
        if (audienceType = "USER_LIST") {
          
          var audienceCost = audience.getStatsFor("LAST_30_DAYS").getCost();
          
          firstPartyCost += audienceCost ;
          
          Logger.log(`Audience Type: ${audienceType}\tAudience Name: ${audienceName}\t\t\t\t\tAudience Total Cost: ${audienceCost}\tTotal 1P Audiences Cost: ${firstPartyCost}\n`);
          
        }
      }
    }
  }
  