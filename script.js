$(function () {
    $(".menu li").on("click", function () {
        const page = $(this).data("page");

        $("#js-center-content").load("pages/" + page);

        console.log(page)

        $(".menu li").removeClass("active");
        $(this).addClass("active");
    });
});