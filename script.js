window.course="";

$(async function () {
    
    await window.vi_dieu_khien.init();
    await window.lap_trinh_nhung.init();

    $(document).on("click", ".menu-2 li", function (e) {
        e.stopPropagation(); // QUAN TRỌNG: Ngăn không cho sự kiện lan lên li cha
       const parentLi = $(this).closest(".menu > li"); 
       const parentIndex = parentLi.data("index1");
        
        // 2. Lấy index_2 của chính nó
        const subIndex = $(this).index(); 

        console.log("Bài học lớn (index_1):", parentIndex);
        console.log("Link chi tiết (index_2):", subIndex);

        if(window.course=="vi_dieu_khien")
        {
            // 3. Cập nhật đồng thời cả 2 chỉ số trước khi load nội dung
            window.vi_dieu_khien.index_1 = parentIndex;
            window.vi_dieu_khien.index_2 = subIndex;
            window.vi_dieu_khien.loadContent();
        }
        else if(window.course=="lap_trinh_nhung")
        {
            window.lap_trinh_nhung.index_1 = parentIndex;
            window.lap_trinh_nhung.index_2 = subIndex;
            window.lap_trinh_nhung.loadContent();
        }
        
        $(".menu-2 li").removeClass("active-sub");
        $(this).addClass("active-sub");
        // // Cập nhật giao diện active cho link con
    });



    $(document).on("click", ".menu > li", function (e) {
        if ($(e.target).closest('.menu-2').length) return;

        const dir_name=$(this).data("dir");
        window.course=dir_name;

        if(dir_name=="vi_dieu_khien")
        {
            window.vi_dieu_khien.index_1 = $(this).data("index1");
            window.vi_dieu_khien.index_2 = 0; // Reset về slide đầu tiên
            window.vi_dieu_khien.loadContent();
            window.course=dir_name
            //console.log(window.vi_dieu_khien)
        }
        else if(dir_name=="lap_trinh_nhung")
        {
            window.lap_trinh_nhung.index_1 = $(this).data("index1");
            window.lap_trinh_nhung.index_2 = 0; // Reset về slide đầu tiên
            window.lap_trinh_nhung.loadContent();
            //console.log(window.lap_trinh_nhung)
        }
        else
        {
            const page = $(this).data("page");
            $("#sub-center-content").load("pages/" + page);
            console.log(page)
        }
        $(".menu li").removeClass("active");
        $(".menu-2 li").removeClass("active-sub");
        $(this).addClass("active");
    });
});


function toggleLeft() {

    const rightMenus = document.querySelectorAll('.right-menu');
    rightMenus.forEach(menu => {
        menu.classList.remove('active');
    });


    const leftMenu = document.getElementById('left-menu');
    if (leftMenu) {
        leftMenu.classList.toggle('active');
    }

}

function toggleRight() {

    console.log("toggleRight")


    const rightMenus = document.querySelectorAll('.right-menu');
    rightMenus.forEach(menu => {
        menu.classList.toggle('active');
    });


    const leftMenu = document.getElementById('left-menu');
    if (leftMenu) {
          leftMenu.classList.remove('active');
    }
}





