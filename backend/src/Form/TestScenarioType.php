<?php
/**
 * TestScenarioType
 *
 * Form used to create/edit a TestScenario. The stepsJson textarea is enhanced
 * client-side by CodeMirror and the Step Builder.
 */
namespace App\Form;

use App\Entity\TestScenario;
use App\Entity\ScenarioFolder;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;

class TestScenarioType extends AbstractType
{
    /** Build the form fields for a scenario */
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class)
            ->add('folder', EntityType::class, [
                'class' => ScenarioFolder::class,
                'required' => false,
                'placeholder' => 'Aucun dossier',
                'choice_label' => 'name',
            ])
            ->add('baseUrl', TextType::class, [
                'required' => false,
                'label' => 'Base URL (préfixe des URL relatives)',
                'attr' => [
                    'placeholder' => 'https://app.exemple.com',
                ],
                'help' => 'Si défini, les étapes goto avec une URL commençant par / seront résolues avec ce préfixe.'
            ])
            ->add('perStepScreenshot', CheckboxType::class, [
                'required' => false,
                'label' => 'Capture à chaque étape',
            ])
            ->add('screenshotFullPage', CheckboxType::class, [
                'required' => false,
                'label' => 'Capture pleine page',
            ])
            ->add('retries', IntegerType::class, [
                'required' => false,
                'attr' => ['min' => 0, 'max' => 5],
                'label' => 'Nombre d\'essais par étape',
            ])
            ->add('backoffMs', IntegerType::class, [
                'required' => false,
                'attr' => ['min' => 0, 'step' => 100],
                'label' => 'Backoff (ms)',
            ])
            ->add('stepTimeoutMs', IntegerType::class, [
                'required' => false,
                'attr' => ['min' => 1000, 'step' => 500],
                'label' => 'Timeout par étape (ms)',
            ])
            ->add('deviceScaleFactor', ChoiceType::class, [
                'required' => false,
                'label' => "Densité d'image",
                'choices' => [
                    '1x (1920×1080 px)' => 1,
                    '2x (3840×2160 px)' => 2,
                    '3x (5760×3240 px)' => 3,
                ],
            ])
            ->add('userAgent', TextType::class, [
                'required' => false,
                'label' => 'User-Agent (optionnel)',
            ])
            ->add('viewportWidth', IntegerType::class, [
                'required' => false,
                'attr' => ['min' => 320, 'max' => 4096],
            ])
            ->add('viewportHeight', IntegerType::class, [
                'required' => false,
                'attr' => ['min' => 320, 'max' => 4096],
            ])
            ->add('stepsJson', TextareaType::class, [
                'attr' => [
                    'rows' => 18,
                    'class' => 'font-monospace json-editor',
                    'placeholder' => '[{"action":"goto","url":"https://example.org"}]',
                    'data-language' => 'json'
                ],
            ]);
    }

    /** Configure default options */
    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => TestScenario::class]);
    }
}
