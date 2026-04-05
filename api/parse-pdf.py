import os
from tempfile import NamedTemporaryFile

from flask import Flask, jsonify, request

from python.form_e_pdf_parser import parse_form_e


app = Flask(__name__)


def _handle_request():
    uploaded_file = request.files.get("pdfFile")

    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"message": "Vui lòng tải lên file PDF để đọc tờ khai."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"message": "File PDF phải có định dạng .pdf."}), 400

    temp_path = None

    try:
        with NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            uploaded_file.save(temp_file)
            temp_path = temp_file.name

        result = parse_form_e(temp_path)
        return jsonify(result)
    except Exception as error:
        return jsonify({"message": str(error)}), 400
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@app.route("/", methods=["POST"])
@app.route("/api/parse-pdf", methods=["POST"])
def parse_pdf():
    return _handle_request()
