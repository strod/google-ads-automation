

// Replace with your own values
var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1234567890';

// Get the Google Sheet
var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

// Get the campaign by name
var campaign = AdsApp.campaigns()
  .withCondition("Name = '" + CAMPAIGN_NAME + "'")
  .get()
  .next();

// Get all the segments for the campaign
var segments = campaign.segments().get();

// Create a map to store the segment count
var segmentCount = {};

// Loop through all the segments and count them
while (segments.hasNext()) {
  var segment = segments.next();
  var type = segment.getSegmentType();

  if (!segmentCount[type]) {
    segmentCount[type] = 0;
  }

  segmentCount[type]++;
}

// Print the segment count in the Google Sheet
var sheet = spreadsheet.getSheets()[0];

for (var type in segmentCount) {
  sheet.appendRow([type, segmentCount[type]]);
}
