jQuery(document).ready(function ($) {
  $("#downloadButton").on("click", function (e) {
    e.preventDefault();

    $.ajax({
      url: infinity_vars.ajaxurl,
      type: "POST",
      data: {
        action: "download_file",
        security: infinity_vars.security,
      },
      success: function (response) {
        // Create a blob from the response
        var blob = new Blob([response], { type: "image/jpeg" }); // Adjust type as needed
        var url = URL.createObjectURL(blob);

        // Display the image
        $("#downloadedImage").attr("src", url).show();
      },
      error: function (xhr, status, error) {
        console.error("AJAX error:", error);
        alert("An error occurred.");
      },
      xhrFields: {
        responseType: "blob", // Important to handle binary data correctly
      },
    });
  });
});
