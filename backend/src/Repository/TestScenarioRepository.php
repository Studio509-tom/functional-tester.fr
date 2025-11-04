<?php
/**
 * Custom repository for TestScenario with a tiny search helper used by
 * folder pages to filter scenarios by name.
 */
namespace App\Repository;

use App\Entity\TestScenario;
use App\Entity\ScenarioFolder;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class TestScenarioRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry) { parent::__construct($registry, TestScenario::class); }

    /**
     * Search scenarios optionally by folder and case-insensitive name fragment.
     * @return TestScenario[]
     */
    public function searchByFolderAndName(?ScenarioFolder $folder, ?string $q): array
    {
        $qb = $this->createQueryBuilder('s');
        if ($folder) {
            $qb->andWhere('s.folder = :f')->setParameter('f', $folder);
        }
        if ($q !== null && $q !== '') {
            $qb->andWhere('LOWER(s.name) LIKE :q')->setParameter('q', '%' . mb_strtolower($q) . '%');
        }
        $qb->orderBy('s.id', 'DESC');
        return $qb->getQuery()->getResult();
    }
}
