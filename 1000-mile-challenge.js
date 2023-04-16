/*
*  The page above is patiently waiting for some data,
*  we pull it from a gist which is a JSON file generated
*  by a GitHub action written in Ruby. This file is updated
*  whenever data is uploaded by Hadge (github.com/ashtom/hadge)
*  to my private health repo on GitHub. This spits out quite
*  a bit of information, but all we want to do is sum up the
*  running/walking data and calculate it as a percentage against
*  the target.
*/

// getResponse()
// Takes 0 arguments and outputs a jsonified string of data
// from a fixed target
async function getResponse() {
    const response = await fetch(
        'https://gist.githubusercontent.com/tomchatting/74ac0a895a88db1df3e359a046a1f3b0/raw/distance-covered.json',
        {
            method: 'GET'
        }
    );
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

// Future proofing this page by allowing the year to be a variable
// we'll also need to work out if the year is a leap year so we can
// get a valid interpretation of our progress through the year

// add isLeapYear prototype to Date()
Date.prototype.isLeapYear = function () {
    var year = this.getFullYear();
    if ((year & 3) != 0) return false;
    return ((year % 100) != 0 || (year % 400) == 0);
};

// add getDOY prototype to Date(), using isLeapYear
Date.prototype.getDOY = function () {
    var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var mn = this.getMonth();
    var dn = this.getDate();
    var dayOfYear = dayCount[mn] + dn;
    if (mn > 1 && this.isLeapYear()) dayOfYear++;
    return dayOfYear;
};

// getMax takes an array, and a property within it,
// to determine the maximum value in an object
// In this instance I'm using it for dates, but faesibly
// it could have explicit types added to make it work
// with floats etc
function getMax(arr, prop) {
    var max;
    for (var i = 0; i < arr.length; i++) {
        if (max == null || (arr[i][prop]) > (max[prop]))
            max = arr[i];
    }
    return max;
}

var daysInYear = 365;

// just in case I need to use this page again
var year = 2023;

if ((0 == year % 4) && (0 != year % 100) || (0 == year % 400)) daysInYear++;

(async () => {
    /*
     *  Inside an async() operation, we'll get the latest json data,
     *  1. calculate the current latest date provided
     *  2. output this, and a %age representation of our year progress
     *  3. convert our km total moved to miles, and display the percentage
     *  4. clean up any loading indicators and insert our calculated bits
     */
    const returnData = await getResponse();

    const maxDate = new Date(getMax(returnData, 'Date')['Date']);
    const todaysDate = new Date(maxDate).toLocaleDateString('en-GB');
    const dayOfYear = new Date(maxDate).getDOY();
    const yearProgressWidth = (dayOfYear / daysInYear * 100).toFixed(2);

    const yearProgressEle = document.getElementById('year-percent');
    const todaysDatePlaceholderEle = document.getElementById('latest-heading-placeholder');
    const todaysDateEle = document.getElementById('today-date');

    yearProgressEle.style.width = yearProgressWidth + '%';
    yearProgressEle.textContent = yearProgressWidth + '%';
    yearProgressEle.classList.remove('progress-bar-striped');
    yearProgressEle.classList.remove('progress-bar-animated');
    todaysDateEle.textContent = todaysDate;
    todaysDatePlaceholderEle.remove();

    const movedHeadingEle = document.getElementById('moved-heading');
    const movedHeadingPlaceholderEle = document.getElementById('moved-heading-placeholder');
    const movedPercentEle = document.getElementById('moved-percent');

    const movedText = 'So far, Tom has moved ';

    var result = returnData.reduce(function (_this, val) {
        return _this + parseFloat(val['Distance Walking/Running'])
    }, 0);

    const distanceMovedKm = result / 1000;
    const kmToMilesConversionFactor = 1.609;

    const distanceMovedMiles = (distanceMovedKm / kmToMilesConversionFactor).toFixed(2);

    movedHeadingEle.textContent = movedText + distanceMovedMiles + ' miles!';
    movedHeadingPlaceholderEle.remove();

    const distanceMovedPercentage = ((distanceMovedMiles / 1000) * 100).toFixed(2);

    movedPercentEle.classList.remove('progress-bar-striped');
    movedPercentEle.classList.remove('progress-bar-animated');
    movedPercentEle.style.width = distanceMovedPercentage + '%';
    movedPercentEle.textContent = distanceMovedPercentage + '%';

})();