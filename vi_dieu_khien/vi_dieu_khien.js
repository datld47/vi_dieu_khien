window.vi_dieu_khien= {
    data: [],       // Dữ liệu load từ JSON
    index_1: 0,     // Vị trí bài học (Chương)
    index_2: 0,     // Vị trí slide trong bài đó
    root:"vi_dieu_khien",

    init: async function() {
            try {
                // Đợi (await) cho đến khi tải xong JSON mới chạy tiếp
                this.data = await $.getJSON(`${this.root}/vi_dieu_khien.json`);
                console.log("Dữ liệu Vi điều khiển đã tải xong.");
                return this.data; 
            } catch (error) {
                console.error("Lỗi tải JSON:", error);
            }
        },

    loadContent: function() {
        const lesson = this.data[this.index_1];
        if (!lesson) return;

        const fileName = lesson.pages[this.index_2];
        const filePath = `${this.root}/${lesson.folder}/${fileName}`;

        console.log(filePath);

        $.get(filePath, (markdownText) => {
            const html = marked.parse(markdownText);
            $("#js-center-content-1").hide().html(html).fadeIn(200);
            
            $("#js-center-content-1 pre code").each(function(i, block) {
            hljs.highlightElement(block);
        });

            this.updateUI();
        }).fail(() => {
            $("#js-center-content-1").html(`<p style="color:red">Không tìm thấy: ${filePath}</p>`);
        });
    },

    updateUI: function() {
        const totalSlides = this.data[this.index_1].pages.length;
        $("#slide-counter").text(`Trang ${this.index_2 + 1} / ${totalSlides}`);
        $("#btn-prev").prop("disabled", this.index_2 === 0);
        $("#btn-next").prop("disabled", this.index_2 === totalSlides - 1);
    },
}

$(function () {
    
    $(document).on("click", "#btn-next", function () {
        const vdk = window.vi_dieu_khien;
        // Kiểm tra xem dữ liệu đã được nạp chưa và có bài học hiện tại không
        if (vdk.data.length > 0 && vdk.data[vdk.index_1]) {
            const totalSlides = vdk.data[vdk.index_1].pages.length;
            // Nếu chưa phải trang cuối thì tăng index_2
            if (vdk.index_2 < totalSlides - 1) {
                vdk.index_2++;
                vdk.loadContent();
            }
        }
    });


    $(document).on("click", "#btn-prev", function () {
        const vdk = window.vi_dieu_khien;
        // Nếu chưa phải trang đầu thì giảm index_2
        if (vdk.index_2 > 0) {
            vdk.index_2--;
            vdk.loadContent();
        }
    });


    $(document).keydown(function (e) {
        // Chỉ chạy nếu cụm điều khiển slide đang hiển thị trên màn hình
        if ($("#slide-controls").is(":visible")) {
            if (e.which === 39) { // Mũi tên phải
                $("#btn-next").click();
            } else if (e.which === 37) { // Mũi tên trái
                $("#btn-prev").click();
            }
        }
    });

});