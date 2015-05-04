

$(document).ready(function() {

    easySkills();

    showEnglish(false);

});

function easySkills(){
    var counter=1;
    $('.skill').each(function(){
        var el=$(this);
        var level=el.attr('data-level');

        el.append("<div class='bar-holder'><div class='progress-bar'></div></div>")

        el.find('.progress-bar').delay(counter*100).animate({width:level+'%'}, 1500,'easeOutBack')

        counter++;
    });
}

function rexGetElementsByClass( searchClass, domNode, tagName) {
    if (domNode == null) domNode = document;
    if (tagName == null) tagName = '*';
    var el = new Array();
    var tags = domNode.getElementsByTagName(tagName);
    var tcl = " "+searchClass+" ";
    for(i=0,j=0; i<tags.length; i++) {
        var new_one = " " + tags[i].className + " ";
        if (new_one.indexOf(tcl) != -1)
            el[j++] = tags[i];
    }
    return el;
}

function changeToEnglish()
{
    showChinese(false);
    showEnglish(true);
}


function changeToChinese()
{
    showChinese(true);
    showEnglish(false);
}

function showEnglish(show_bool){
    var cssArray=rexGetElementsByClass('english');

    if (show_bool == true) {
        for(i=0; i<cssArray.length; i++)
        {
            cssArray[i].style.display = '';
        }
    } else {
        for(i=0; i<cssArray.length; i++)
        {
            cssArray[i].style.display = 'none';
        }
    }

}


function showChinese(show_bool){
    var cssArray=rexGetElementsByClass('chinese');


    if (show_bool == true) {
        for(i=0; i<cssArray.length; i++)
        {
            cssArray[i].style.display = '';
        }
    } else {
        for(i=0; i<cssArray.length; i++)
        {
            cssArray[i].style.display = 'none';
        }
    }
}



function listMember(main) {
    var s = "";
for( key in main )  // 使用 in 運算子列舉所有成員
    s += key + ": " + main[key] + "\n";
return s;
}

