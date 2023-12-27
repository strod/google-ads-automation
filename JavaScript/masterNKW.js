// Copyright 2015, Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @name Master Negative List Script
 *
 * @overview The Master Negative List script applies negative keywords and
 *     placements from a spreadsheet to multiple campaigns in your account using
 *     shared keyword and placement lists. The script can process multiple
 *     Google Ads accounts in parallel. See
 *     https://developers.google.com/google-ads/scripts/docs/solutions/master-negative-list
 *     for more details.
 *
 * @author Google Ads Scripts Team [adwords-scripts@googlegroups.com]
 *
 * @version 1.0.2
 *
 * @changelog
 * - version 1.0.2
 *   - Added validation for external spreadsheet setup.
 * - version 1.0.1
 *   - Improvements to time zone handling.
 * - version 1.0
 *   - Released initial version.
 */

/**
 * The URL of the tracking spreadsheet. This should be a copy of
 * https://goo.gl/PZGKVn
 */
 var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1GT1f3YpeE1ZFNG0fZzX41fPmYu0ozHhuYuXu-NFP5TE/edit#gid=0';

 /**
  * Keep track of the spreadsheet names for various criteria types, as well as
  * the criteria type being processed.
  */
 var CriteriaType = {
   KEYWORDS: 'Keywords',
   PLACEMENTS: 'Placements'
 };
 
 function main() {
   var emailParams = {
     // Number of placements that were synced.
     PlacementCount: 0,
     // Number of keywords that were synced.
     KeywordCount: 0,
     // Number of campaigns that were synced.
     CampaignCount: 0,
     // Status of processing this account - OK / ERROR.
     Status: ''
   };
 
   try {
     var syncSummary = syncMasterLists();
 
     emailParams.PlacementCount = syncSummary.PlacementCount;
     emailParams.KeywordCount = syncSummary.KeywordCount;
     emailParams.CampaignCount = syncSummary.CampaignCount;
     emailParams.Status = 'OK';
   } catch (err) {
     emailParams.Status = 'ERROR';
   }
   var config = readConfig();
 
   var spreadsheet = validateAndGetSpreadsheet(SPREADSHEET_URL);
 
   // Make sure the spreadsheet is using the account's timezone.
   spreadsheet.setSpreadsheetTimeZone(AdsApp.currentAccount().getTimeZone());
   spreadsheet.getRangeByName('LastRun').setValue(new Date());
   spreadsheet.getRangeByName('CustomerId').setValue(
       AdsApp.currentAccount().getCustomerId());
 
   sendEmail(config, emailParams);
 }
 
 /**
  * Sends a summary email about the changes that this script made.
  *
  * @param {Object} config The configuration object.
  * @param {Object} emailParams Contains details required to create the email
  *     body.
  */
 function sendEmail(config, emailParams) {
   var html = [];
   var summary = '';
 
   if (emailParams.Status == 'OK') {
     summary = 'The Master Negative List script successfully processed ' +
         'Customer ID: ' + AdsApp.currentAccount().getCustomerId() +
         ' and synced a total of ' + emailParams.KeywordCount +
         ' keywords and ' + emailParams.PlacementCount + ' placements.';
   } else {
     summary = 'The Master Negative List script failed to process ' +
         'Customer ID: ' + AdsApp.currentAccount().getCustomerId() +
         ' and synced a total of ' + emailParams.KeywordCount +
         ' keywords and ' + emailParams.PlacementCount + ' placements.';
   }
   html.push('<html>',
               '<head></head>',
                  '<body>',
                   '<table style="font-family:Arial,Helvetica; ' +
                        'border-collapse:collapse;font-size:10pt; ' +
                        'color:#444444; border: solid 1px #dddddd;" ' +
                        'width="600" cellpadding=20>',
                      '<tr>',
                        '<td>',
                          '<p>Hello,</p>',
                          '<p>' + summary + '</p>',
                          '<p>Cheers<br />Thrive Regional Team</p>',
                        '</td>',
                      '</tr>',
                    '</table>',
                  '</body>',
              '</html>'
            );
 
   if (config.email != '') {
     MailApp.sendEmail({
       to: config.email,
       subject: 'Master Negative List Script',
       htmlBody: html.join('\n')
     });
   }
 }
 
 /**
  * Synchronizes the negative criteria list in an account with the master list
  * in the user spreadsheet.
  *
  * @return {Object} A summary of the number of keywords and placements synced,
  *     and the number of campaigns to which these lists apply.
  */
 function syncMasterLists() {
   var config = readConfig();
   var syncedCampaignCount = 0;
 
   var keywordListDetails = syncCriteriaInNegativeList(config,
       CriteriaType.KEYWORDS);
   syncedCampaignCount = syncCampaignList(config, keywordListDetails.SharedList,
       CriteriaType.KEYWORDS);
 
   var placementListDetails = syncCriteriaInNegativeList(config,
       CriteriaType.PLACEMENTS);
   syncCampaignList(config, placementListDetails.SharedList,
       CriteriaType.PLACEMENTS);
 
   return {
     'CampaignCount': syncedCampaignCount,
     'PlacementCount': placementListDetails.CriteriaCount,
     'KeywordCount': keywordListDetails.CriteriaCount
   };
 }
 
 /**
  * Synchronizes the list of campaigns covered by a negative list against the
  * desired list of campaigns to be covered by the master list.
  *
  * @param {Object} config The configuration object.
  * @param {AdsApp.NegativeKeywordList|AdsApp.ExcludedPlacementList}
  *    sharedList The shared negative criterion list to be synced against the
  *    master list.
  * @param {String} criteriaType The criteria type for the shared negative list.
  *
  * @return {Number} The number of campaigns synced.
  */
 function syncCampaignList(config, sharedList, criteriaType) {
   var campaignIds = getLabelledCampaigns(config.label);
   var totalCampaigns = Object.keys(campaignIds).length;
 
   var listedCampaigns = sharedList.campaigns().get();
 
   var campaignsToRemove = [];
 
   while (listedCampaigns.hasNext()) {
     var listedCampaign = listedCampaigns.next();
     if (listedCampaign.getId() in campaignIds) {
       delete campaignIds[listedCampaign.getId()];
     } else {
       campaignsToRemove.push(listedCampaign);
     }
   }
 
   // Anything left over in campaignIds starts a new list.
   var campaignsToAdd = AdsApp.campaigns().withIds(
       Object.keys(campaignIds)).get();
   while (campaignsToAdd.hasNext()) {
     var campaignToAdd = campaignsToAdd.next();
 
     if (criteriaType == CriteriaType.KEYWORDS) {
       campaignToAdd.addNegativeKeywordList(sharedList);
     } else if (criteriaType == CriteriaType.PLACEMENTS) {
       campaignToAdd.addExcludedPlacementList(sharedList);
     }
   }
 
   for (var i = 0; i < campaignsToRemove.length; i++) {
     if (criteriaType == CriteriaType.KEYWORDS) {
       campaignsToRemove[i].removeNegativeKeywordList(sharedList);
     } else if (criteriaType == CriteriaType.PLACEMENTS) {
       campaignsToRemove[i].removeExcludedPlacementList(sharedList);
     }
   }
 
   return totalCampaigns;
 }
 
 /**
  * Gets a list of campaigns having a particular label.
  *
  * @param {String} labelText The label text.
  *
  * @return {Array.<Number>} An array of campaign IDs having the specified
  *     label.
  */
 function getLabelledCampaigns(labelText) {
   var campaignIds = {};
 
   if (labelText != '') {
     var label = getLabel(labelText);
     var campaigns = label.campaigns().withCondition(
         'Status in [ENABLED, PAUSED]').get();
   } else {
     var campaigns = AdsApp.campaigns().withCondition(
         'Status in [ENABLED, PAUSED]').get();
   }
 
   while (campaigns.hasNext()) {
     var campaign = campaigns.next();
     campaignIds[campaign.getId()] = 1;
   }
   return campaignIds;
 }
 
 /**
  * Gets a label with the specified label text.
  *
  * @param {String} labelText The label text.
  *
  * @return {AdsApp.Label} The label text.
  */
 function getLabel(labelText) {
   var labels = AdsApp.labels().withCondition(
       "Name='" + labelText + "'").get();
   if (labels.totalNumEntities() == 0) {
     var message = Utilities.formatString('Label named %s is missing in your ' +
         'account. Make sure the label exists in the account, and is applied ' +
         'to campaigns and adgroups you wish to process.', labelText);
     throw (message);
   }
 
   return labels.next();
 }
 
 /**
  * Synchronizes the criteria in a shared negative criteria list with the user
  * spreadsheet.
  *
  * @param {Object} config The configuration object.
  * @param {String} criteriaType The criteria type for the shared negative list.
  *
  * @return {Object} A summary of the synced negative list, and the number of
  *     criteria that were synced.
  */
 function syncCriteriaInNegativeList(config, criteriaType) {
   var criteriaFromSheet = loadCriteria(criteriaType);
   var totalCriteriaCount = Object.keys(criteriaFromSheet).length;
 
   var sharedList = null;
   var listName = config.listname[criteriaType];
 
   sharedList = createNegativeListIfRequired(listName, criteriaType);
 
   var negativeCriteria = null;
 
   try {
     if (criteriaType == CriteriaType.KEYWORDS) {
       negativeCriteria = sharedList.negativeKeywords().get();
     } else if (criteriaType == CriteriaType.PLACEMENTS) {
       negativeCriteria = sharedList.excludedPlacements().get();
     }
   } catch (e) {
     Logger.log('Failed to retrieve shared list. Error says ' + e);
     if (AdsApp.getExecutionInfo().isPreview()) {
       var message = Utilities.formatString('The script cannot create the ' +
           'negative %s list in preview mode. Either run the script without ' +
           'preview, or create a negative %s list with name "%s" manually ' +
           'before previewing the script.', criteriaType, criteriaType,
           listName);
       Logger.log(message);
     }
     throw e;
   }
 
   var criteriaToDelete = [];
 
   while (negativeCriteria.hasNext()) {
     var negativeCriterion = negativeCriteria.next();
     var key = null;
 
     if (criteriaType == CriteriaType.KEYWORDS) {
       key = negativeCriterion.getText();
     } else if (criteriaType == CriteriaType.PLACEMENTS) {
       key = negativeCriterion.getUrl();
     }
 
     if (key in criteriaFromSheet) {
       // Nothing to do with this criteria. Remove it from loaded list.
       delete criteriaFromSheet[key];
     } else {
       // This criterion is not in the sync list. Mark for deletion.
       criteriaToDelete.push(negativeCriterion);
     }
   }
 
   // Whatever left in the sync list are new items.
   if (criteriaType == CriteriaType.KEYWORDS) {
     sharedList.addNegativeKeywords(Object.keys(criteriaFromSheet));
   } else if (criteriaType == CriteriaType.PLACEMENTS) {
     sharedList.addExcludedPlacements(Object.keys(criteriaFromSheet));
   }
 
   for (var i = 0; i < criteriaToDelete.length; i++) {
     criteriaToDelete[i].remove();
   }
 
   return {
     'SharedList': sharedList,
     'CriteriaCount': totalCriteriaCount,
     'Type': criteriaType
   };
 }
 
 /**
  * Creates a shared negative criteria list if required.
  *
  * @param {string} listName The name of shared negative criteria list.
  * @param {String} listType The criteria type for the shared negative list.
  *
  * @return {AdsApp.NegativeKeywordList|AdsApp.ExcludedPlacementList} An
  *     existing shared negative criterion list if it already exists in the
  *     account, or the newly created list if one didn't exist earlier.
  */
 function createNegativeListIfRequired(listName, listType) {
   var negativeListSelector = null;
   if (listType == CriteriaType.KEYWORDS) {
     negativeListSelector = AdsApp.negativeKeywordLists();
   } else if (listType == CriteriaType.PLACEMENTS) {
     negativeListSelector = AdsApp.excludedPlacementLists();
   }
   var negativeListIterator = negativeListSelector.withCondition(
       "Name = '" + listName + "'").get();
 
   if (negativeListIterator.totalNumEntities() == 0) {
     var builder = null;
 
     if (listType == CriteriaType.KEYWORDS) {
       builder = AdsApp.newNegativeKeywordListBuilder();
     } else if (listType == CriteriaType.PLACEMENTS) {
       builder = AdsApp.newExcludedPlacementListBuilder();
     }
 
     var negativeListOperation = builder.withName(listName).build();
     return negativeListOperation.getResult();
   } else {
     return negativeListIterator.next();
   }
 }
 
 /**
  * Loads a list of criteria from the user spreadsheet.
  *
  * @param {string} sheetName The name of shared negative criteria list.
  *
  * @return {Object} A map of the list of criteria loaded from the spreadsheet.
  */
 function loadCriteria(sheetName) {
   var spreadsheet = validateAndGetSpreadsheet(SPREADSHEET_URL);
   var sheet = spreadsheet.getSheetByName(sheetName);
   var values = sheet.getRange('B4:B').getValues();
 
   var retval = {};
   for (var i = 0; i < values.length; i++) {
     var keyword = values[i][0].toString().trim();
     if (keyword != '') {
       retval[keyword] = 1;
     }
   }
   return retval;
 }
 
 /**
  * Loads a configuration object from the spreadsheet.
  *
  * @return {Object} A configuration object.
  */
 function readConfig() {
   var spreadsheet = validateAndGetSpreadsheet(SPREADSHEET_URL);
   var values = spreadsheet.getRangeByName('ConfigurationValues').getValues();
 
   var config = {
     'label': values[0][0],
     'listname': {
     },
     'email': values[3][0],
   };
   config.listname[CriteriaType.KEYWORDS] = values[1][0];
   config.listname[CriteriaType.PLACEMENTS] = values[2][0];
   return config;
 }
 
 /**
  * DO NOT EDIT ANYTHING BELOW THIS LINE.
  * Please modify your spreadsheet URL at the top of the file only.
  */
 
 /**
  * Validates the provided spreadsheet URL and email address
  * to make sure that they're set up properly. Throws a descriptive error message
  * if validation fails.
  *
  * @param {string} spreadsheeturl The URL of the spreadsheet to open.
  * @return {Spreadsheet} The spreadsheet object itself, fetched from the URL.
  * @throws {Error} If the spreadsheet URL or email hasn't been set
  */
 function validateAndGetSpreadsheet(spreadsheeturl) {
   if (spreadsheeturl == 'INSERT_SPREADSHEET_URL_HERE') {
     throw new Error('Please specify a valid Spreadsheet URL. You can find' +
         ' a link to a template in the associated guide for this script.');
   }
   var spreadsheet = SpreadsheetApp.openByUrl(spreadsheeturl);
   return spreadsheet;
 }
 