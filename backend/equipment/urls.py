from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.UploadCSV.as_view(), name='upload_csv'),
    path('datasets/', views.DatasetList.as_view(), name='dataset_list'),
    path('download/<int:id>/', views.DatasetDownload.as_view(), name='dataset_download'),
    path('latest_summary/', views.LatestSummary.as_view(), name='latest_summary'),
]
