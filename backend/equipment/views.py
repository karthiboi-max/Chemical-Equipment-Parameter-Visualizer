from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from .models import Dataset
import os
import pandas as pd

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, "datasets")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def compute_summary(df):
    summary = {
        "total_rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict(orient="records"),
        "type_distribution": {},
        "averages": {}
    }
    if "Type" in df.columns:
        summary["type_distribution"] = df["Type"].value_counts().to_dict()
    for col in ["Flowrate", "Pressure", "Temperature"]:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            summary["averages"][f"{col.lower()}_avg"] = df[col].mean()
    return summary

class UploadCSV(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        file_path = os.path.join(UPLOAD_DIR, file.name)

        try:
            with open(file_path, "wb") as f:
                for chunk in file.chunks():
                    f.write(chunk)
            df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')
        except Exception as e:
            return Response({"error": f"Could not save/parse CSV: {str(e)}"}, status=500)

        summary = compute_summary(df)

        try:
            file.seek(0)
            Dataset.objects.create(
                file_name=file.name,
                raw_csv=file.read().decode(errors='ignore'),
                summary=summary
            )
        except Exception as e:
            return Response({"error": f"Could not save to database: {str(e)}"}, status=500)

        return Response({"message": "Uploaded successfully", "summary": summary})

class DatasetList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        datasets = Dataset.objects.all().order_by('-uploaded_at')
        return Response([
            {"id": ds.id, "file_name": ds.file_name, "uploaded_at": ds.uploaded_at, "summary": ds.summary}
            for ds in datasets
        ])

class DatasetDownload(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id=None, filename=None):
        try:
            if id is not None:
                ds = Dataset.objects.get(id=id)
            elif filename is not None:
                ds = Dataset.objects.get(file_name=filename)
            else:
                return Response({"error": "Provide id or filename"}, status=400)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found"}, status=404)
        return Response(ds.raw_csv)

class LatestSummary(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ds = Dataset.objects.all().order_by('-uploaded_at').first()
        if not ds:
            return Response({"error": "No datasets found"}, status=404)

        try:
            df = pd.read_csv(os.path.join(UPLOAD_DIR, ds.file_name), encoding='utf-8', on_bad_lines='skip')
        except Exception as e:
            return Response({"error": f"Could not read CSV: {str(e)}"}, status=500)

        summary = compute_summary(df)
        summary["file_name"] = ds.file_name
        return Response({"latest_summary": summary})
