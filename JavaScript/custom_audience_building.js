/**
*
* In-market Audiences Bidding
*
* Automatically apply modifiers to your in-market audiences based on performance.
*
* Version: 1.0
* Google AdWords Script maintained by rodrigo.teixeira@thrive-umww.com
*
**/

// Use this to determine the relevant date range for your data.
// See here for the possible options:
// https://developers.google.com/google-ads/scripts/docs/reference/adwordsapp/adwordsapp_campaignselector#forDateRange_1
var DATE_RANGE = 'LAST_30_DAYS';

// Use this to determine the minimum number of impressions a campaign or
// and ad group should have before being considered.
var MINIMUM_IMPRESSIONS = 0;

// Use this if you want to exclude some campaigns. Case insensitive.
// For example ["Brand"] would ignore any campaigns with 'brand' in the name,
// while ["Brand","Competitor"] would ignore any campaigns with 'brand' or
// 'competitor' in the name.
// Leave as [] to not exclude any campaigns.
var CAMPAIGN_NAME_DOES_NOT_CONTAIN = [];

// Use this if you only want to look at some campaigns.  Case insensitive.
// For example ["Brand"] would only look at campaigns with 'brand' in the name,
// while ["Brand","Generic"] would only look at campaigns with 'brand' or 'generic'
// in the name.
// Leave as [] to include all campaigns.
var CAMPAIGN_NAME_CONTAINS = [];

var AUDIENCE_MAPPING_CSV_DOWNLOAD_URL = 'https://developers.google.com/adwords/api/docs/appendix/in-market_categories.csv';

function main() {
  Logger.log('Getting audience mapping');
  var audienceMapping =
    getInMarketAudienceMapping(AUDIENCE_MAPPING_CSV_DOWNLOAD_URL);

  Logger.log('Getting campaign performance');
  var campaignPerformance = getCampaignPerformance();

  Logger.log('Getting ad group performance');
  var adGroupPerformance = getAdGroupPerformance();

  Logger.log('Making operations');
  var operations = makeAllOperations(
    audienceMapping,
    campaignPerformance,
    adGroupPerformance
  );

  Logger.log('Applying bids');
  applyBids(operations);
}

function getInMarketAudienceMapping(downloadCsvUrl) {
  var csv = Utilities.parseCsv(
    UrlFetchApp.fetch(downloadCsvUrl).getContentText()
  );

  var headers = csv[0];
  var indexOfId = headers.indexOf('Criterion ID');
  var indexOfName = headers.indexOf('Category');

  if ((indexOfId === -1) || (indexOfName === -1)) {
    throw new Error('The audience CSV does not have the expected headers');
  }

  var mapping = {};
  for (var i = 1; i < csv.length; i++) {
    var row = csv[i];
    mapping[row[indexOfId]] = row[indexOfName];
  }

  return mapping;
}

function getCampaignPerformance() {
  return getEntityPerformance('CampaignId', 'CAMPAIGN_PERFORMANCE_REPORT');
}

function getAdGroupPerformance() {
  return getEntityPerformance('AdGroupId', 'ADGROUP_PERFORMANCE_REPORT');
}

function getEntityPerformance(entityIdFieldName, reportName) {
  var performance = {};
  var query = "SELECT " + entityIdFieldName + ", CostPerAllConversion " +
      "FROM " + reportName + " " +
      "WHERE Impressions > " + String(MINIMUM_IMPRESSIONS) + " " +
      "DURING " + DATE_RANGE;
  var rows = AdsApp.report(query).rows();

  while (rows.hasNext()) {
    var row = rows.next();
    performance[row[entityIdFieldName]] = row.CostPerAllConversion;
  }
  return performance;
}

function makeAllOperations(
  audienceMapping,
  campaignPerformance,
  adGroupPerformance
) {
  var operations = [];

  var allCampaigns =
    filterCampaignsBasedOnName(AdWordsApp.campaigns());

  var filteredCampaigns =
    filterEntitiesBasedOnDateAndImpressions(allCampaigns)
    .get();

  while (filteredCampaigns.hasNext()) {
    var campaign = filteredCampaigns.next();

    // Can't have both ad-group-level and campaign-level
    // audiences on any given campaign.
    if (campaignHasAnyCampaignLevelAudiences(campaign)) {
      var operationsFromCampaign = makeOperationsFromEntity(
        campaign,
        campaignPerformance[campaign.getId()],
        audienceMapping
      );

      operations = operations.concat(operationsFromCampaign);
    } else {
      var adGroups =
        filterEntitiesBasedOnDateAndImpressions(campaign.adGroups())
        .get();

      while (adGroups.hasNext()) {
        var adGroup = adGroups.next();
        var operationsFromAdGroup = makeOperationsFromEntity(
          adGroup,
          adGroupPerformance[adGroup.getId()],
          audienceMapping
        );

        operations = operations.concat(operationsFromAdGroup);
      }
    }
  }

  return operations;
}

function filterCampaignsBasedOnName(campaigns) {
  CAMPAIGN_NAME_DOES_NOT_CONTAIN.forEach(function(part) {
    campaigns = campaigns.withCondition(
      "CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + part.replace(/"/g,'\\\"') + "'"
    );
  });

  CAMPAIGN_NAME_CONTAINS.forEach(function(part) {
    campaigns = campaigns.withCondition(
      "CampaignName CONTAINS_IGNORE_CASE '" + part.replace(/"/g,'\\\"') + "'"
    );
  });

  return campaigns;
}

function filterEntitiesBasedOnDateAndImpressions(selector) {
  return selector
    .forDateRange(DATE_RANGE)
    .withCondition('Impressions > ' + String(MINIMUM_IMPRESSIONS));
}

function makeOperationsFromEntity(entity, entityCpa, audienceMapping) {
    var entityAudiences = getAudiencesFromEntity(entity, audienceMapping);
    return makeOperations(entityCpa, entityAudiences);
}

function getAudiencesFromEntity(entity, audienceMapping) {
  var inMarketIds = Object.keys(audienceMapping);

  var allAudiences = entity
    .targeting()
    .audiences()
    .forDateRange(DATE_RANGE)
    .withCondition('Impressions > ' + String(MINIMUM_IMPRESSIONS))
    .get();

  var inMarketAudiences = [];
  while (allAudiences.hasNext()) {
    var audience = allAudiences.next();
    if (isAudienceInMarketAudience(audience, inMarketIds)) {
      inMarketAudiences.push(audience);
    }
  }

  return inMarketAudiences;
}

function isAudienceInMarketAudience(audience, inMarketIds) {
  return inMarketIds.indexOf(audience.getAudienceId()) > -1;
}

function makeOperations(entityCpa, audiences) {
  var operations = [];
  audiences.forEach(function(audience) {
    var stats = audience.getStatsFor(DATE_RANGE);
    var conversions = stats.getConversions();
    if (conversions > 0) {
      var audienceCpa = stats.getCost() / stats.getConversions();
      entityCpa = parseFloat(entityCpa);
      var modifier = (entityCpa / audienceCpa);

      var operation = {};
      operation.audience = audience;
      operation.modifier = modifier;

      operations.push(operation);
    }
  });

  return operations;
}

function campaignHasAnyCampaignLevelAudiences(campaign) {
  var totalNumEntities = campaign
  .targeting()
  .audiences()
  .get()
  .totalNumEntities();

  return totalNumEntities > 0;
}

function applyBids(operations) {
  operations.forEach(function(operation) {
    operation.audience.bidding().setBidModifier(operation.modifier);
  });
}