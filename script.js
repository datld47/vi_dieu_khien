
$(async function () {
    
    await window.vi_dieu_khien.init();
    
    $(document).on("click", ".menu li", function () {
        const dir_name=$(this).data("dir");        
        if(dir_name=="vi_dieu_khien")
        {
            window.vi_dieu_khien.index_1 = $(this).data("index1");
            window.vi_dieu_khien.index_2 = 0; // Reset về slide đầu tiên
            window.vi_dieu_khien.loadContent();
            console.log(window.vi_dieu_khien)
        }
        else
        {
            const page = $(this).data("page");
            $("#js-center-content").load("pages/" + page);
        }
        $(".menu li").removeClass("active");
        $(this).addClass("active");
    });
});