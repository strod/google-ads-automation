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
    
    while (campaignIterator.hasNext()){
      
      var campaign = campaignIterator.next();
      var campaignName = campaign.getName();
      var campaignId = campaign.getId();
      
      var campaignStartDate = campaign.getStartDate();
      var campaignEndDate = campaign.getEndDate();
      
      if (campaignEndDate == null) {
        console.log(`End Date is null for campaign ${campaignName}`);
        
        var StartDate = new Date(campaignStartDate.year, campaignStartDate.month, campaignStartDate.day);
        var EndDate = new Date();
        
      } else {
        
        var StartDate = new Date(campaignStartDate.year, campaignStartDate.month, campaignStartDate.day);
        var EndDate = new Date(campaignEndDate.year, campaignEndDate.month, campaignEndDate.day);
      
      }
         
      // Getting Campaign Duration
      var campaignDuration = DateDiff(StartDate, EndDate);
      
      // If Campaign is shorter than 6 weeks, rule is beeing violated
      if (campaignDuration < 42) {
        
        var emailList = emailMap[advertiserId];
        
        if (!emailList) {
          continue;
        }
        
        var emailText = `The following Campaign :\n ${campaignName}\n(ID: ${campaignId}) is too short (${campaignDuration} days) make sure all your campaign are at least 6 weeks long`;
        emailText += "\n Please check and make sure the rule is being implemented \n";
        
        sendEmails(emailList, `Golden Rules Alert | Right Execution | Rule 3 - Min 6W Flight [ ${campaignId} ]`, emailText);
      
      } else {
        console.log(`Campaign :\n ${campaignName}\n(ID: ${campaignId}) is ${campaignDuration} days long`)
      }
    }
  }
  
  function DateDiff(StartDate, EndDate) {
    // Convert dates to milliseconds
    // Calculate the time difference in milliseconds
    var timeDiff = Math.abs(EndDate.getTime() - StartDate.getTime());
  
    // Convert time difference to days
    var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return daysDiff
  }
  
  function sendEmails(to, subject, body) {
    to.forEach(function(email) {
      MailApp.sendEmail(email, subject, body);
    });
  }