const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const productController = require("../controllers/product.controller");


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "_" + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

router.post("/products", upload.array("images", 4), productController.createProduct);
router.get("/products", productController.getAllProducts);
router.get("/search", productController.searchProducts);
router.delete("/products/:id", productController.deleteProduct);
router.put("/products/:id", productController.updateProduct);
router.get('/products/:id', productController.getProductById);
router.get('/bidder/:id', productController.getBidder);


module.exports = router;
